#!/bin/bash
# =========================================================
# 하루노트 서버 시작 버튼
# Finder에서 이 파일을 더블클릭하면 서버가 켜지고 브라우저가 열립니다.
# 끄려면 열린 터미널 창에서 Ctrl + C 를 누르거나 창을 닫으세요.
# =========================================================

cd "$(dirname "$0")" || exit 1   # 이 파일이 있는 폴더(code)로 이동
PORT=5001                         # 포트 번호를 바꾸려면 이 숫자를 고치세요

# 이미 켜져 있으면 브라우저만 엽니다.
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "이미 $PORT번에서 서버가 켜져 있어요. 브라우저를 엽니다."
  open "http://localhost:$PORT"
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3를 찾을 수 없어요. 강사님께 python3 설치를 요청해 주세요."
  read -r -p "Enter를 누르면 창이 닫힙니다."
  exit 1
fi

echo "📒 하루노트 서버를 켰어요: http://localhost:$PORT"
echo "   끄려면 이 창에서 Ctrl + C 를 누르거나 창을 닫으세요."
echo

(sleep 1; open "http://localhost:$PORT") &   # 1초 뒤 브라우저 열기
python3 server.py $PORT   # 옛 파일을 기억하지 않는 서버 (server.py)
