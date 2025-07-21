#!/usr/bin/env python3
"""
PD Software API 연결 테스트 스크립트
HTTPS 리다이렉트 루프 문제 해결 확인용
"""

import requests
import json
import sys
from datetime import datetime

# 색상 코드
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_header(text):
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}{text:^60}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")

def test_endpoint(url, method='GET', data=None):
    """엔드포인트 테스트"""
    print(f"\n📍 Testing: {url}")
    print(f"   Method: {method}")
    
    try:
        if method == 'GET':
            response = requests.get(url, timeout=5)
        elif method == 'POST':
            headers = {'Content-Type': 'application/json'}
            response = requests.post(url, headers=headers, json=data, timeout=5)
        elif method == 'OPTIONS':
            response = requests.options(url, timeout=5)
        
        # 결과 출력
        status_color = GREEN if response.status_code < 400 else RED
        print(f"   Status: {status_color}{response.status_code} {response.reason}{RESET}")
        
        # 헤더 확인
        cors_headers = {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin', 'Not set'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods', 'Not set'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers', 'Not set')
        }
        
        print(f"   CORS Headers:")
        for header, value in cors_headers.items():
            if value != 'Not set':
                print(f"     ✅ {header}: {value}")
            else:
                print(f"     ❌ {header}: {value}")
        
        # 응답 본문 (일부)
        if response.text:
            preview = response.text[:200] + '...' if len(response.text) > 200 else response.text
            print(f"   Response: {preview}")
        
        return True
        
    except requests.exceptions.Timeout:
        print(f"   {RED}❌ Timeout - 서버 응답 없음{RESET}")
        return False
    except requests.exceptions.ConnectionError as e:
        print(f"   {RED}❌ Connection Error: {str(e)}{RESET}")
        return False
    except Exception as e:
        print(f"   {RED}❌ Error: {str(e)}{RESET}")
        return False

def main():
    print_header("ReturnFeed PD API 연결 테스트")
    print(f"\n테스트 시작: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 테스트할 엔드포인트 목록
    test_cases = [
        {
            'name': 'HTTP API 접근 테스트',
            'tests': [
                ('http://returnfeed.net/api/pd-auth/login-pd', 'POST', {'pdId': 'test', 'password': 'test'}),
                ('http://returnfeed.net/api/pd-auth/register-pd', 'OPTIONS', None),
                ('http://returnfeed.net/api/pd-auth/stream-info', 'GET', None)
            ]
        },
        {
            'name': '8092 포트 직접 접근 테스트',
            'tests': [
                ('http://returnfeed.net:8092/api/pd-auth/login-pd', 'POST', {'pdId': 'test', 'password': 'test'}),
                ('http://returnfeed.net:8092/api/pd-auth/stream-info', 'GET', None)
            ]
        },
        {
            'name': 'HTTPS API 접근 테스트',
            'tests': [
                ('https://returnfeed.net/api/pd-auth/login-pd', 'POST', {'pdId': 'test', 'password': 'test'}),
                ('https://returnfeed.net/api/pd-auth/stream-info', 'GET', None)
            ]
        }
    ]
    
    # 각 테스트 케이스 실행
    results = []
    for test_group in test_cases:
        print_header(test_group['name'])
        group_results = []
        
        for url, method, data in test_group['tests']:
            success = test_endpoint(url, method, data)
            group_results.append((url, success))
        
        results.append((test_group['name'], group_results))
    
    # 결과 요약
    print_header("테스트 결과 요약")
    
    total_tests = 0
    passed_tests = 0
    
    for group_name, group_results in results:
        print(f"\n{YELLOW}{group_name}:{RESET}")
        for url, success in group_results:
            total_tests += 1
            if success:
                passed_tests += 1
                print(f"  ✅ {url}")
            else:
                print(f"  ❌ {url}")
    
    # 최종 결과
    print(f"\n{BLUE}{'='*60}{RESET}")
    success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
    
    if success_rate == 100:
        print(f"{GREEN}✅ 모든 테스트 통과! ({passed_tests}/{total_tests}){RESET}")
    elif success_rate >= 50:
        print(f"{YELLOW}⚠️  일부 테스트 통과 ({passed_tests}/{total_tests}){RESET}")
    else:
        print(f"{RED}❌ 대부분의 테스트 실패 ({passed_tests}/{total_tests}){RESET}")
    
    # 권장사항
    if success_rate < 100:
        print(f"\n{YELLOW}권장사항:{RESET}")
        print("1. 서버가 실행 중인지 확인: sudo systemctl status nginx")
        print("2. 방화벽 설정 확인: sudo ufw status")
        print("3. 백엔드 서버 상태 확인: docker ps")
        print("4. NGINX 에러 로그 확인: sudo tail -f /var/log/nginx/error.log")

if __name__ == "__main__":
    main()