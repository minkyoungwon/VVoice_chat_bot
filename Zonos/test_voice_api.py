#!/usr/bin/env python3
"""
보이스 클로닝 API 테스트 스크립트
"""

import requests
import json
import os
from typing import Dict, Any

def test_api_endpoint(url: str, method: str = "GET", data: Dict[str, Any] = None) -> Dict[str, Any]:
    """API 엔드포인트 테스트"""
    try:
        print(f"\n🔍 테스트 중: {method} {url}")
        
        if method == "GET":
            response = requests.get(url, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=10)
        else:
            raise ValueError(f"지원되지 않는 HTTP 메서드: {method}")
        
        print(f"📡 응답 상태: {response.status_code}")
        print(f"📡 응답 헤더: {dict(response.headers)}")
        
        # 응답 내용 확인
        content_type = response.headers.get('content-type', '')
        print(f"📄 Content-Type: {content_type}")
        
        if response.text:
            print(f"📝 응답 텍스트 (처음 500자):")
            print(response.text[:500])
            print("..." if len(response.text) > 500 else "")
        else:
            print("📝 응답이 비어있습니다")
        
        # JSON 파싱 시도
        if 'application/json' in content_type:
            try:
                json_data = response.json()
                print(f"✅ JSON 파싱 성공:")
                print(json.dumps(json_data, indent=2, ensure_ascii=False))
                return {
                    "success": True,
                    "status_code": response.status_code,
                    "data": json_data,
                    "content_type": content_type
                }
            except json.JSONDecodeError as e:
                print(f"❌ JSON 파싱 실패: {e}")
                return {
                    "success": False,
                    "status_code": response.status_code,
                    "error": f"JSON 파싱 실패: {str(e)}",
                    "raw_content": response.text,
                    "content_type": content_type
                }
        else:
            return {
                "success": False,
                "status_code": response.status_code,
                "error": f"JSON이 아닌 응답 (Content-Type: {content_type})",
                "raw_content": response.text,
                "content_type": content_type
            }
        
    except requests.exceptions.ConnectionError:
        print("❌ 연결 오류: 서버가 실행되지 않았거나 주소가 잘못되었습니다")
        return {
            "success": False,
            "error": "연결 오류 - 서버가 실행되지 않음"
        }
    except requests.exceptions.Timeout:
        print("❌ 타임아웃: 서버 응답이 너무 느립니다")
        return {
            "success": False,
            "error": "타임아웃"
        }
    except Exception as e:
        print(f"❌ 예상치 못한 오류: {e}")
        return {
            "success": False,
            "error": f"예상치 못한 오류: {str(e)}"
        }

def test_voice_apis():
    """보이스 관련 API들 테스트"""
    base_url = "http://localhost:8000"
    
    print("🎤 보이스 클로닝 API 테스트 시작")
    print("=" * 50)
    
    # 1. 서버 헬스체크
    print("\n1️⃣ 서버 헬스체크")
    health_result = test_api_endpoint(f"{base_url}/")
    
    if not health_result.get("success"):
        print("❌ 서버가 응답하지 않습니다. 서버를 먼저 시작해주세요.")
        print("💡 실행 명령: python main.py")
        return
    
    # 2. TTS 상태 확인
    print("\n2️⃣ TTS 상태 확인")
    tts_status_result = test_api_endpoint(f"{base_url}/api/tts/status")
    
    # 3. 보이스 목록 API 테스트
    print("\n3️⃣ 보이스 목록 API 테스트")
    voices_result = test_api_endpoint(f"{base_url}/api/tts/voices")
    
    # 4. 감정 프리셋 API 테스트
    print("\n4️⃣ 감정 프리셋 API 테스트")
    emotions_result = test_api_endpoint(f"{base_url}/api/tts/emotions")
    
    # 5. 보이스 캐시 통계 테스트
    print("\n5️⃣ 보이스 캐시 통계 테스트")
    cache_stats_result = test_api_endpoint(f"{base_url}/api/tts/voice-cache/stats")
    
    # 결과 요약
    print("\n" + "=" * 50)
    print("📊 테스트 결과 요약")
    print("=" * 50)
    
    tests = [
        ("서버 헬스체크", health_result),
        ("TTS 상태", tts_status_result),
        ("보이스 목록", voices_result),
        ("감정 프리셋", emotions_result),
        ("보이스 캐시 통계", cache_stats_result)
    ]
    
    for test_name, result in tests:
        status = "✅ 성공" if result.get("success") else "❌ 실패"
        error_msg = f" - {result.get('error', '')}" if not result.get("success") else ""
        print(f"{test_name}: {status}{error_msg}")
    
    # 문제가 있는 경우 해결 방안 제시
    failed_tests = [name for name, result in tests if not result.get("success")]
    
    if failed_tests:
        print(f"\n🔧 해결 방안:")
        print(f"실패한 테스트: {', '.join(failed_tests)}")
        
        if "서버 헬스체크" in failed_tests:
            print("1. 백엔드 서버가 실행되고 있는지 확인:")
            print("   cd C:\\src\\zonos_train\\Zonos")
            print("   python main.py")
        
        if "보이스 목록" in failed_tests:
            print("2. assets/voices/ 폴더 확인:")
            print("   - assets/voices/ 폴더가 존재하는지 확인")
            print("   - 폴더에 .wav, .mp3, .flac 파일이 있는지 확인")
        
        print("3. 방화벽 또는 포트 충돌 확인:")
        print("   - 포트 8000이 다른 프로그램에서 사용되고 있지 않은지 확인")
        print("   - Windows 방화벽에서 Python을 허용했는지 확인")
    else:
        print("\n🎉 모든 테스트가 성공했습니다!")
        print("🔧 다음 단계:")
        print("1. 프론트엔드에서 보이스 선택 테스트")
        print("2. 실제 목소리 업로드 테스트")
        print("3. TTS 생성에서 커스텀 목소리 적용 확인")

def test_voice_upload():
    """보이스 업로드 테스트 (테스트 파일이 있는 경우)"""
    print("\n🎵 보이스 업로드 테스트")
    print("=" * 30)
    
    # 테스트용 오디오 파일 경로들
    test_audio_paths = [
        "assets/voices/test.wav",
        "assets/voices/sample.wav",
        "test_audio.wav"
    ]
    
    test_file_found = None
    for path in test_audio_paths:
        if os.path.exists(path):
            test_file_found = path
            break
    
    if test_file_found:
        print(f"📁 테스트 파일 발견: {test_file_found}")
        
        try:
            with open(test_file_found, 'rb') as f:
                files = {'file': (os.path.basename(test_file_found), f, 'audio/wav')}
                response = requests.post(
                    "http://localhost:8000/api/tts/upload-voice",
                    files=files,
                    timeout=30
                )
            
            print(f"📡 업로드 응답 상태: {response.status_code}")
            print(f"📝 업로드 응답:")
            
            try:
                result = response.json()
                print(json.dumps(result, indent=2, ensure_ascii=False))
                
                if result.get("status") == "success":
                    print("✅ 업로드 테스트 성공!")
                else:
                    print("❌ 업로드 테스트 실패")
                    
            except json.JSONDecodeError:
                print("❌ 업로드 응답 JSON 파싱 실패")
                print(f"원본 응답: {response.text}")
                
        except Exception as e:
            print(f"❌ 업로드 테스트 중 오류: {e}")
    else:
        print("📁 테스트용 오디오 파일을 찾을 수 없습니다")
        print("💡 테스트하려면 다음 위치에 .wav 파일을 추가하세요:")
        for path in test_audio_paths:
            print(f"   - {path}")

if __name__ == "__main__":
    print("🔧 보이스 클로닝 API 진단 도구")
    print("=" * 50)
    
    # 기본 API 테스트
    test_voice_apis()
    
    # 업로드 테스트 (선택사항)
    test_voice_upload()
    
    print("\n🏁 테스트 완료")
