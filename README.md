# 별밤 아웃랜드

별밤 길드원용 배틀로얄 게임입니다. 링크 하나로 PC·휴대폰에서 바로 접속합니다.

## 폴더 구성
- `public/index.html` — 게임 본체 (업데이트할 때는 이 파일만 교체)
- `src/worker.js` — 길드 방 중계 서버 (최대 20명/방)
- `wrangler.toml` — Cloudflare 배포 설정

## 처음 한 번만: 배포하기
1. GitHub에서 **New repository** → 이름 `byeolbam-outland` → Create
2. **uploading an existing file** 클릭 → 압축 푼 폴더 안의 `public`, `src`, `wrangler.toml`, `README.md`를 통째로 끌어다 놓고 → **Commit changes**
3. https://dash.cloudflare.com 가입/로그인 → **Workers & Pages → Create → Import a repository**
4. GitHub 연결 → `byeolbam-outland` 선택 → 설정은 그대로 두고 **Deploy**
5. 완료되면 `https://byeolbam-outland.<계정이름>.workers.dev` 주소가 나옵니다 → 이 주소를 길드원에게 공유

## 플레이
- 주소 접속 → 닉네임·직업 선택 → 방 이름 맞추고 **길드 방 입장**
- 먼저 들어온 사람이 방장, 방장이 봇 수·맵 크기 정하고 시작
- 휴대폰에 파일을 받아서 할 경우: 서버 주소 칸에 `byeolbam-outland.<계정이름>.workers.dev` 입력

## 업데이트
GitHub에서 `public/index.html`을 새 파일로 교체 → 1~2분 뒤 자동 반영
