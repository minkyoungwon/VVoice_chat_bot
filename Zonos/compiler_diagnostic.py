# compiler_diagnostic.py - 컴파일러 설치 상태 확인

import os
import subprocess
import sys
from pathlib import Path

def check_compiler_installation():
    """Visual Studio C++ 컴파일러 설치 상태 확인"""
    print("🔍 Microsoft C++ Build Tools 설치 상태 확인")
    print("=" * 60)
    
    # 1. cl.exe 명령어 직접 확인
    print("\n1️⃣ cl.exe 명령어 확인:")
    try:
        result = subprocess.run(['cl'], capture_output=True, text=True, timeout=10)
        if result.returncode == 0 or "Microsoft (R) C/C++ Optimizing Compiler" in result.stderr:
            print("✅ cl.exe 명령어 사용 가능")
            print(f"출력: {result.stderr[:200]}")
        else:
            print("❌ cl.exe 명령어 실행 실패")
    except FileNotFoundError:
        print("❌ cl.exe를 찾을 수 없습니다")
    except Exception as e:
        print(f"❌ cl.exe 확인 중 오류: {e}")
    
    # 2. where 명령어로 cl.exe 위치 찾기
    print("\n2️⃣ cl.exe 파일 위치 확인:")
    try:
        result = subprocess.run(['where', 'cl'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ cl.exe 위치:")
            for line in result.stdout.strip().split('\n'):
                print(f"   📁 {line}")
        else:
            print("❌ where 명령어로 cl.exe를 찾을 수 없습니다")
    except Exception as e:
        print(f"❌ where 명령어 실행 오류: {e}")
    
    # 3. Visual Studio 설치 경로 확인
    print("\n3️⃣ Visual Studio/Build Tools 설치 경로 확인:")
    vs_paths = [
        "C:\\Program Files\\Microsoft Visual Studio",
        "C:\\Program Files (x86)\\Microsoft Visual Studio",
        "C:\\BuildTools",
        "C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools",
        "C:\\Program Files\\Microsoft Visual Studio\\2019\\BuildTools",
        "C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools"
    ]
    
    found_paths = []
    for path in vs_paths:
        if os.path.exists(path):
            print(f"✅ {path}")
            found_paths.append(path)
            
            # VC 도구 확인
            vc_tools_path = Path(path)
            for vc_dir in vc_tools_path.glob("**/VC/Tools/MSVC/*/bin/Hostx64/x64"):
                cl_path = vc_dir / "cl.exe"
                if cl_path.exists():
                    print(f"   🔧 cl.exe 발견: {cl_path}")
        else:
            print(f"❌ {path}")
    
    # 4. 환경변수 확인
    print("\n4️⃣ 관련 환경변수 확인:")
    env_vars = ['PATH', 'INCLUDE', 'LIB', 'LIBPATH', 'VS140COMNTOOLS', 'VS160COMNTOOLS']
    for var in env_vars:
        value = os.environ.get(var, '')
        if 'Visual Studio' in value or 'BuildTools' in value or 'MSVC' in value:
            print(f"✅ {var}: {value[:100]}...")
        elif var == 'PATH':
            print(f"ℹ️  PATH에 Visual Studio 관련 경로 없음")
    
    # 5. PyTorch 컴파일 테스트
    print("\n5️⃣ PyTorch 컴파일 테스트:")
    try:
        import torch
        print(f"PyTorch 버전: {torch.__version__}")
        
        # 간단한 컴파일 테스트
        if torch.cuda.is_available():
            device = torch.device('cuda')
        else:
            device = torch.device('cpu')
            
        x = torch.randn(10, 10, device=device)
        
        # torch.compile 테스트
        @torch.compile(backend='inductor')
        def simple_func(x):
            return x * 2 + 1
            
        result = simple_func(x)
        print("✅ PyTorch 컴파일 테스트 성공")
        
    except Exception as e:
        print(f"❌ PyTorch 컴파일 테스트 실패: {e}")
    
    # 6. 권장 해결책
    print("\n6️⃣ 권장 해결책:")
    if not found_paths:
        print("❌ Visual Studio Build Tools가 설치되지 않은 것 같습니다.")
        print("   💡 해결책: Visual Studio Build Tools 재설치")
    else:
        print("✅ Build Tools가 설치되어 있지만 PATH 설정에 문제가 있을 수 있습니다.")
        print("   💡 해결책들:")
        print("   1. Developer Command Prompt 사용")
        print("   2. vcvarsall.bat 실행")
        print("   3. 환경변수 수동 설정")
        print("   4. PyTorch 컴파일 비활성화 (임시)")

if __name__ == "__main__":
    check_compiler_installation()