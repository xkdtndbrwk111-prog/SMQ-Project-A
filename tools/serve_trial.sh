#!/bin/sh
# HOJA Phase 1B 시험판 실행: 빌드 → 정적 검사 → 같은 와이파이의 태블릿에서도 열리게 서버 실행 (Ctrl+C로 종료)
#   sh tools/serve_trial.sh [포트=8080]
set -e
cd "$(dirname "$0")/.."
node tools/build_web.mjs
node tools/check_web.mjs
PORT="${1:-8080}"
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '이-컴퓨터-IP')"
echo ""
echo "교사 화면 (이 컴퓨터):        http://127.0.0.1:$PORT/"
echo "교사 화면 (QR을 만들 때 사용): http://$IP:$PORT/   ← 태블릿이 같은 와이파이에 있어야 함"
echo "Phaser는 인터넷(jsDelivr)에서 받으므로 인터넷 연결이 필요합니다."
exec python3 -m http.server "$PORT" --bind 0.0.0.0 --directory dist
