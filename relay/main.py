import asyncio
import logging
import json
import websockets
from websockets.exceptions import ConnectionClosed

# --- 로깅 설정 ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# --- '게시판' 역할을 할 변수들 ---
# 접속한 모든 클라이언트(카메라맨) 목록
CONNECTED_CLIENTS = set()
# 서버가 기억하고 있을 '최신 카메라 목록' (JSON 문자열 형태)
LATEST_INPUT_LIST = None

# --- 웹소켓 핸들러 함수 ---
async def handler(websocket, path):
    """
    클라이언트가 연결되면 호출되는 메인 핸들러.
    새 클라이언트에게는 저장된 목록을 즉시 보내주고,
    모든 메시지를 받아 종류에 따라 처리하고 브로드캐스트합니다.
    """
    global LATEST_INPUT_LIST # 전역 변수 LATEST_INPUT_LIST를 사용하겠다고 선언

    remote_address = websocket.remote_address
    logging.info(f"클라이언트 연결됨: {remote_address}")
    CONNECTED_CLIENTS.add(websocket)

    try:
        # --- 새로운 클라이언트를 위한 '게시판' 기능 ---
        # 만약 서버가 최신 카메라 목록을 가지고 있다면,
        if LATEST_INPUT_LIST:
            try:
                # 새로 접속한 이 클라이언트에게만! 저장된 목록을 보내준다.
                await websocket.send(LATEST_INPUT_LIST)
                logging.info(f"새 클라이언트에게 저장된 목록 전송 완료: {remote_address}")
            except ConnectionClosed:
                logging.warning(f"목록 전송 중 새 클라이언트 연결 끊김: {remote_address}")
                # 연결이 바로 끊겼으므로 함수를 여기서 종료
                return

        # --- 모든 클라이언트로부터 오는 메시지를 처리하는 루프 ---
        async for message in websocket:
            # PD 프로그램으로부터 받은 메시지를 모든 클라이언트에게 전달 (브로드캐스트)
            websockets.broadcast(CONNECTED_CLIENTS, message)
            
            # --- PD가 보낸 메시지인지 확인하고 '게시판'에 저장 ---
            try:
                data = json.loads(message)
                # 메시지 타입이 'input_list' 라면, 이 메시지를 '최신 목록'으로 저장한다.
                if data.get("type") == "input_list":
                    LATEST_INPUT_LIST = message
                    logging.info(f"새로운 카메라 목록을 수신하여 '게시판'에 업데이트했습니다.")
            except json.JSONDecodeError:
                # JSON 형식이 아닌 메시지는 무시
                logging.warning(f"JSON 형식이 아닌 메시지 수신: {message[:100]}")
            except Exception as e:
                logging.error(f"메시지 처리 중 내부 오류: {e}")

    except ConnectionClosed:
        logging.info(f"클라이언트 연결 끊김 (정상): {remote_address}")
    except Exception as e:
        logging.error(f"핸들러 오류 발생 ({remote_address}): {e}")
    finally:
        # 연결이 끊기면 목록에서 제거
        logging.info(f"연결 종료 및 클라이언트 제거: {remote_address}")
        CONNECTED_CLIENTS.remove(websocket)

# --- 서버를 시작하는 메인 함수 ---
async def main():
    host = "0.0.0.0"
    port = 8765
    
    async with websockets.serve(handler, host, port):
        logging.info(f"업그레이드된 탈리 중계 서버가 ws://{host}:{port} 에서 시작되었습니다.")
        await asyncio.Future()  # 서버를 영원히 실행

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("서버를 종료합니다.")
