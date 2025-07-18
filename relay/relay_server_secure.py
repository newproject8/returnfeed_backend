import asyncio
import logging
import json
import websockets
import jwt
import os
from websockets.exceptions import ConnectionClosed
from typing import Dict, Set, Optional
from dataclasses import dataclass, field
from datetime import datetime
from urllib.parse import parse_qs, urlparse

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# JWT 시크릿 키 (환경변수에서 가져오기)
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable is required")
JWT_ALGORITHM = 'HS256'

@dataclass
class Client:
    """클라이언트 정보를 저장하는 클래스"""
    websocket: websockets.WebSocketServerProtocol
    session_id: Optional[str] = None
    role: str = "viewer"  # pd, camera, staff, viewer
    user_id: Optional[str] = None
    connected_at: datetime = field(default_factory=datetime.now)
    authenticated: bool = False
    auth_token: Optional[str] = None

@dataclass
class Session:
    """방송 세션 정보를 저장하는 클래스"""
    session_id: str
    pd_client: Optional[Client] = None
    clients: Set[Client] = field(default_factory=set)
    tally_state: Dict = field(default_factory=lambda: {
        "program": None,
        "preview": None,
        "inputs": {}
    })
    created_at: datetime = field(default_factory=datetime.now)

class SecureRelayServer:
    def __init__(self):
        self.sessions: Dict[str, Session] = {}
        self.clients: Dict[websockets.WebSocketServerProtocol, Client] = {}
        
    async def authenticate_client(self, websocket, token: str) -> Optional[Dict]:
        """JWT 토큰을 검증하고 사용자 정보 반환"""
        try:
            # JWT 토큰 디코드 및 검증
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            
            # 토큰 만료 시간 확인 (옵션)
            if 'exp' in payload:
                exp_timestamp = payload['exp']
                if datetime.fromtimestamp(exp_timestamp) < datetime.now():
                    await self.send_error(websocket, "Token expired")
                    return None
            
            return payload
        except jwt.ExpiredSignatureError:
            await self.send_error(websocket, "Token expired")
            return None
        except jwt.InvalidTokenError as e:
            await self.send_error(websocket, f"Invalid token: {str(e)}")
            return None
        except Exception as e:
            logging.error(f"Authentication error: {e}")
            await self.send_error(websocket, "Authentication failed")
            return None
    
    async def register_client(self, websocket, message: Dict):
        """클라이언트를 세션에 등록"""
        # 토큰 확인
        token = message.get("token")
        if not token:
            await self.send_error(websocket, "Authentication token required")
            await websocket.close(code=1008, reason="Authentication required")
            return
        
        # 토큰 검증
        auth_payload = await self.authenticate_client(websocket, token)
        if not auth_payload:
            await websocket.close(code=1008, reason="Authentication failed")
            return
        
        session_id = message.get("sessionId")
        role = message.get("role", "viewer")
        user_id = auth_payload.get("userId", auth_payload.get("sub"))  # JWT의 subject 또는 userId 사용
        
        if not session_id:
            await self.send_error(websocket, "sessionId is required")
            return
        
        # 권한 확인 - PD 역할은 특별한 권한이 필요할 수 있음
        if role in ["pd", "pd_software"] and not auth_payload.get("isPD", False):
            await self.send_error(websocket, "Insufficient permissions for PD role")
            return
        
        # 클라이언트 객체 생성
        client = Client(
            websocket=websocket,
            session_id=session_id,
            role=role,
            user_id=user_id,
            authenticated=True,
            auth_token=token
        )
        
        # 세션이 없으면 생성
        if session_id not in self.sessions:
            self.sessions[session_id] = Session(session_id=session_id)
            logging.info(f"새 세션 생성: {session_id}")
        
        session = self.sessions[session_id]
        
        # PD 클라이언트 등록
        if role == "pd" or role == "pd_software":
            if session.pd_client and session.pd_client.websocket.open:
                await self.send_error(websocket, "PD already connected to this session")
                return
            session.pd_client = client
            logging.info(f"PD 클라이언트 등록: {session_id} (user: {user_id})")
        
        # 세션에 클라이언트 추가
        session.clients.add(client)
        self.clients[websocket] = client
        
        # 등록 확인 메시지
        await websocket.send(json.dumps({
            "type": "session_registered",
            "sessionId": session_id,
            "role": role,
            "userId": user_id,
            "authenticated": True,
            "timestamp": datetime.now().isoformat()
        }))
        
        # 현재 탈리 상태 전송
        if session.tally_state["inputs"]:
            await websocket.send(json.dumps({
                "type": "tally_update",
                **session.tally_state
            }))
        
        logging.info(f"클라이언트 등록 완료: {role} (user: {user_id}) in session {session_id}")
    
    async def handle_tally_update(self, client: Client, message: Dict):
        """PD로부터 탈리 업데이트 처리"""
        if not client.authenticated:
            await self.send_error(client.websocket, "Not authenticated")
            return
            
        if client.role not in ["pd", "pd_software"]:
            await self.send_error(client.websocket, "Unauthorized to send tally updates")
            return
        
        session = self.sessions.get(client.session_id)
        if not session:
            return
        
        # 탈리 상태 업데이트
        session.tally_state.update({
            "program": message.get("program"),
            "preview": message.get("preview"),
            "inputs": message.get("inputs", {}),
            "timestamp": datetime.now().isoformat()
        })
        
        # 같은 세션의 모든 클라이언트에게 브로드캐스트
        broadcast_message = json.dumps({
            "type": "tally_update",
            **session.tally_state
        })
        
        disconnected_clients = []
        for session_client in session.clients:
            try:
                await session_client.websocket.send(broadcast_message)
            except ConnectionClosed:
                disconnected_clients.append(session_client)
        
        # 연결이 끊긴 클라이언트 제거
        for client in disconnected_clients:
            session.clients.remove(client)
    
    async def handle_message(self, websocket, message: str):
        """메시지 처리"""
        try:
            data = json.loads(message)
            msg_type = data.get("type")
            
            # 클라이언트가 등록되지 않은 경우
            if websocket not in self.clients and msg_type != "register":
                await self.send_error(websocket, "Not registered. Please register first.")
                return
            
            if msg_type == "register":
                await self.register_client(websocket, data)
            elif msg_type == "register_pd":
                # 기존 PD 등록 메시지와의 호환성
                data["role"] = "pd_software"
                await self.register_client(websocket, data)
            elif msg_type == "tally_update":
                client = self.clients.get(websocket)
                if client:
                    await self.handle_tally_update(client, data)
            elif msg_type == "ping":
                await websocket.send(json.dumps({"type": "pong"}))
            elif msg_type == "input_list":
                # 기존 input_list 메시지 호환성
                client = self.clients.get(websocket)
                if client and client.role in ["pd", "pd_software"]:
                    data["type"] = "tally_update"
                    data["inputs"] = data.get("inputs", {})
                    await self.handle_tally_update(client, data)
            else:
                logging.warning(f"Unknown message type: {msg_type}")
                
        except json.JSONDecodeError:
            await self.send_error(websocket, "Invalid JSON format")
        except Exception as e:
            logging.error(f"Error handling message: {e}")
            await self.send_error(websocket, f"Internal error: {str(e)}")
    
    async def send_error(self, websocket, message: str):
        """에러 메시지 전송"""
        try:
            await websocket.send(json.dumps({
                "type": "error",
                "message": message,
                "timestamp": datetime.now().isoformat()
            }))
        except:
            pass
    
    async def handle_disconnect(self, websocket):
        """클라이언트 연결 해제 처리"""
        client = self.clients.get(websocket)
        if not client:
            return
        
        session = self.sessions.get(client.session_id)
        if session:
            session.clients.discard(client)
            
            # PD 클라이언트가 연결 해제된 경우
            if session.pd_client == client:
                session.pd_client = None
                logging.info(f"PD 클라이언트 연결 해제: {client.session_id} (user: {client.user_id})")
            
            # 세션에 클라이언트가 없으면 세션 제거
            if not session.clients:
                del self.sessions[client.session_id]
                logging.info(f"빈 세션 제거: {client.session_id}")
        
        del self.clients[websocket]
        logging.info(f"클라이언트 연결 해제: {client.role} (user: {client.user_id}) from session {client.session_id}")
    
    async def handler(self, websocket, path):
        """웹소켓 연결 핸들러"""
        remote_address = websocket.remote_address
        logging.info(f"새 연결: {remote_address}")
        
        # URL 쿼리 파라미터에서 토큰 추출 (옵션)
        # 예: ws://localhost:8765?token=xxx
        parsed_url = urlparse(path)
        query_params = parse_qs(parsed_url.query)
        url_token = query_params.get('token', [None])[0]
        
        if url_token:
            # URL에 토큰이 있으면 즉시 인증 시도
            auth_payload = await self.authenticate_client(websocket, url_token)
            if not auth_payload:
                await websocket.close(code=1008, reason="Authentication failed")
                return
        
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except ConnectionClosed:
            logging.info(f"연결 종료: {remote_address}")
        except Exception as e:
            logging.error(f"핸들러 오류: {e}")
        finally:
            await self.handle_disconnect(websocket)

async def main():
    server = SecureRelayServer()
    host = "0.0.0.0"
    port = 8765
    
    # JWT 시크릿 확인
    if JWT_SECRET == 'your_jwt_secret':
        logging.warning("경고: 기본 JWT 시크릿을 사용 중입니다. 프로덕션에서는 환경변수 JWT_SECRET을 설정하세요.")
    
    async with websockets.serve(server.handler, host, port):
        logging.info(f"보안 강화된 다중 세션 지원 Relay Server 시작: ws://{host}:{port}")
        logging.info(f"JWT 인증 활성화됨")
        await asyncio.Future()  # 서버 계속 실행

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("서버 종료")