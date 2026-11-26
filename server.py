# =========================================================
# 하루노트 로컬 서버
# 이 폴더의 파일을 http://localhost:5001 로 보여줍니다.
# 브라우저가 옛 파일을 기억(캐시)하지 않도록 해서, 코드를 고친 뒤 새로고침하면 바로 반영됩니다.
# 실행: python3 server.py        (포트를 바꾸려면: python3 server.py 5002)
# =========================================================
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
os.chdir(os.path.dirname(os.path.abspath(__file__)))  # 이 파일이 있는 폴더를 기준으로


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # 브라우저가 파일 20여 개를 한꺼번에 요청해도 연결이 끊기지 않도록 대기열을 넉넉하게 (기본값 5)
    request_queue_size = 128
    daemon_threads = True


print(f"하루노트 서버: http://localhost:{PORT}  (끄려면 Ctrl + C)")
Server(("", PORT), NoCacheHandler).serve_forever()
