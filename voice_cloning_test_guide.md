# 보이스 클로닝 기능 테스트 가이드

## 문제 해결 진행 상황

### 06월 10일 - 저녁
**문제**: VoiceSelector에서 JSON 파싱 오류 ('Unexpected end of JSON input')

**해결한 내용**:
1. ✅ API 엔드포인트 에러 핸들링 강화
   - `/api/tts/voices` - 로깅 추가, VoiceManager 인스턴스 확인, JSONResponse 사용
   - `/api/tts/upload-voice` - 파일 검증 강화, 상세 로깅, 에러 응답 개선

2. ✅ 필요한 디렉터리 생성
   - `assets/voices/` - 기본 목소리 파일 폴더
   - `assets/voices/user/` - 사용자 업로드 목소리 폴더

3. ✅ 테스트 스크립트 생성
   - `test_voice_api.py` - API 엔드포인트 자동 테스트

## 테스트 방법

### 1. 백엔드 서버 실행
```bash
cd C:\src\zonos_train\Zonos
python main.py
```

### 2. API 테스트 실행
```bash
cd C:\src\zonos_train\Zonos
python test_voice_api.py
```

### 3. 프론트엔드 테스트
1. 프론트엔드 서버 실행:
   ```bash
   cd C:\src\zonos_train\Front\ChatBot
   npm run dev
   ```
2. 브라우저에서 `localhost:5173` 접속
3. "음성 설정" → "목소리" 탭에서 테스트

## 확인할 점

- [ ] 백엔드 서버가 포트 8000에서 정상 실행되는가?
- [ ] `/api/tts/voices` API가 JSON 응답을 반환하는가?
- [ ] 프론트엔드에서 목소리 목록이 로드되는가?
- [ ] 목소리 파일 업로드가 작동하는가?

## 다음 단계

문제가 해결되면:
1. 실제 목소리 파일을 `assets/voices/` 폴더에 추가
2. TTS 생성 시 커스텀 목소리 적용 테스트
3. 대화형 WebSocket에서 목소리 클로닝 동작 확인
