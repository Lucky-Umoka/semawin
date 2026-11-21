# Semawin

**Semawin** is a voice-powered business ledger for African market traders, small shops and farmers. You say or type what happened ("Mama Ngozi took 2 trays of eggs on credit at 5k each"), the app turns it into a clean entry, you confirm it, and Semawin works out your revenue, cost of goods, profit and who still owes you.

- **Live app:** https://semawin.luckyumoka.tech
- **Demo video (2 min):** 
- **Repository:** https://github.com/Lucky-Umoka/semawin

## Why I built it

Many small traders keep their records in their head or on loose paper, so they do not know their real profit or exactly who owes them money. Typing into forms is slow when you are serving customers. Semawin lets them just talk. It is meant for small businesses and farmers who need to see what they really earn.

## Features

- **Speak or type** an entry. Voice is turned into text with Groq Whisper, then an LLM turns the sentence into a structured entry (type, item, quantity, unit price, customer, paid or not).
- **Confirm before saving.** The parsed entry shows in an editable card. Nothing is saved until the user presses Save, so mistakes can be fixed.
- **Profit tracking:** revenue, cost of goods, gross profit, expenses, net profit, and profit per item (simple bar chart).
- **Unpaid credit tracking:** total owed, owed per customer, and a "Mark paid" button.
- **Search, filter and sort** the ledger:
  - Search by item or customer name.
  - Filter by type (sale, purchase, expense) and by paid or owed.
  - Sort by newest, oldest, biggest amount, or item A-Z.
- **CSV backup and restore** (download the ledger, load it back on any device).
- **Works without the AI.** If the AI service is down, a simple built-in reader handles basic sentences like "sold 3 eggs at 4500".
- **Responsive** layout for phone, tablet and desktop.
- Currencies: RWF, UGX, KES, NGN, GHS.

### How the numbers are calculated

- **Revenue** = all sales.
- **Cost of goods** = quantity sold x the unit price of the most recent purchase of that item.
- **Gross profit** = sales minus cost of goods (only for items that have a recorded purchase; items without one are listed in a warning).
- **Net profit** = gross profit minus expenses. Purchases are stock, not expenses.
- **Owed** = sales that are not marked as paid.

## How it works

```
Browser (HTML, CSS, JavaScript)  -->  Flask API (Python)  -->  Groq API
   ledger saved in localStorage        /api/transcribe         Whisper (speech to text)
                                       /api/parse              LLM (text to entry)
```

The backend is stateless: it keeps no data, so any server behind the load balancer can answer any request. The ledger lives in the user's browser (`localStorage`) and can be backed up as CSV.

## Run it locally

You need Python 3.8 or newer and a Groq API key (free at https://console.groq.com).

```bash
git clone https://github.com/Lucky-Umoka/semawin.git
cd semawin
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
```

Open `.env` and replace `your_key_here` with your Groq API key:

```
GROQ_API_KEY=your_key_here
```

Start the app:

```bash
python3 backend/app.py
```

Open http://localhost:5000. The microphone works on `localhost`. On any other address the page must be served over https.

The API key for grading is given in the assignment submission comment. It is never stored in this repository (`.env` is in `.gitignore`).

## API documentation

### External API used: Groq (OpenAI-compatible)

Base URL: `https://api.groq.com/openai/v1`, sent with the header `Authorization: Bearer <GROQ_API_KEY>`.

| Used for | Endpoint | Model | Docs |
|---|---|---|---|
| Speech to text | `POST /audio/transcriptions` | `whisper-large-v3` | https://console.groq.com/docs/speech-to-text |
| Sentence to structured entry | `POST /chat/completions` (JSON output, temperature 0) | `openai/gpt-oss-20b` | https://console.groq.com/docs/model/openai/gpt-oss-20b |

General reference: https://console.groq.com/docs/api-reference

### Semawin's own endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/api/health` | Returns `{"status": "ok", "server": "<hostname>"}`. Used by the load balancer health check. |
| POST | `/api/transcribe` | Form field `audio` (recorded file, max 10 MB). Returns `{"text": "..."}`. |
| POST | `/api/parse` | JSON `{"text": "..."}` (max 500 characters). Returns `{"entry": {...}, "source": "ai" or "backup"}`. |

Every response also carries an `X-Served-By` header with the name of the server that answered. The page shows it in the footer, which makes the load balancing visible.

Example `entry`:

```json
{"type": "sale", "item": "eggs", "quantity": 2, "unit_price": 5000,
 "total": 10000, "customer": "Mama Ngozi", "paid": false}
```

Error codes: `400` missing or invalid input, `413` file too large, `422` nothing understood (empty audio, silence, or an unreadable sentence), `429` AI rate limit reached, `500` server problem (for example no API key set), `502` the AI service could not be reached. All errors come back as JSON `{"error": "message"}`.

## Deployment

| Server | Role | Address |
|---|---|---|
| web-01 | app server (nginx + gunicorn) | 3.82.139.39 |
| web-02 | app server (nginx + gunicorn) | 18.170.30.95 |
| lb-01 | load balancer (HAProxy, SSL) | 13.135.103.182 |

DNS: an `A` record `semawin.luckyumoka.tech` points to lb-01.

### Each web server (web-01 and web-02)

```bash
sudo apt update
sudo apt install -y git python3-venv
git clone https://github.com/Lucky-Umoka/semawin.git
cd semawin
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

The `.env` file with the API key is copied from my own machine with `scp` (never from git) and locked with `chmod 600 .env`.

Gunicorn runs the app as a service (`/etc/systemd/system/semawin.service`):

```ini
[Unit]
Description=Semawin app
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/semawin/backend
ExecStart=/home/ubuntu/semawin/.venv/bin/gunicorn --workers 2 --timeout 60 --bind 127.0.0.1:8000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now semawin
```

nginx passes requests to gunicorn (`/etc/nginx/sites-available/semawin`, linked into `sites-enabled`):

```nginx
server {
    listen 80;
    server_name semawin.luckyumoka.tech;
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

`client_max_body_size` is raised because nginx's default of 1 MB would reject voice recordings. Then `sudo nginx -t && sudo systemctl reload nginx`.

### Load balancer (lb-01)

1. Get a certificate: stop HAProxy, run `sudo certbot certonly --standalone -d semawin.luckyumoka.tech`, start HAProxy again.
2. Join certificate and key into the file HAProxy reads:
   ```bash
   sudo bash -c 'cat /etc/letsencrypt/live/semawin.luckyumoka.tech/fullchain.pem /etc/letsencrypt/live/semawin.luckyumoka.tech/privkey.pem > /etc/haproxy/certs/semawin.luckyumoka.tech.pem'
   sudo chmod 600 /etc/haproxy/certs/semawin.luckyumoka.tech.pem
   ```
3. HAProxy config (`/etc/haproxy/haproxy.cfg`). Port 80 redirects to https, and requests for the Semawin host go to their own server group with a health check:
   ```
   frontend https_front
       bind *:443 ssl crt /etc/haproxy/certs/www.luckyumoka.tech.pem crt /etc/haproxy/certs/semawin.luckyumoka.tech.pem
       mode http
       acl is_semawin hdr(host) -i semawin.luckyumoka.tech
       use_backend semawin_back if is_semawin
       default_backend http_back

   backend semawin_back
       mode http
       balance roundrobin
       option httpchk GET /api/health HTTP/1.1\r\nHost:\ semawin.luckyumoka.tech
       server 6385-web-01 3.82.139.39:80 check
       server 6385-web-02 18.170.30.95:80 check
   ```
4. Check and apply: `sudo haproxy -c -f /etc/haproxy/haproxy.cfg && sudo systemctl reload haproxy`.

The load balancer already served another site (`www.luckyumoka.tech`), so Semawin was added as a separate host rule and certificate. The old site was left untouched.

### Testing the load balancer

```bash
for i in 1 2 3 4; do curl -s https://semawin.luckyumoka.tech/api/health; echo; done
```

The `server` value alternates between `6385-web-01` and `6385-web-02`. If one server is stopped (`sudo systemctl stop semawin`), the health check removes it and all requests go to the other one. When it is started again, it rejoins automatically.

## Security and error handling

- The API key is only in `.env` (ignored by git) on each machine. It is never in the code or the repository.
- The backend validates everything it receives: audio size and length, text length, and the entry fields (type, quantity and price limits).
- Whisper can invent words such as "you" or "thank you" on silence, so those results are rejected instead of being turned into entries.
- If the AI fails, the user sees a clear message and the simple built-in reader takes over where it can. If the server is unreachable, the page says so and typing still works.
- The page builds the ledger table with `textContent` (not `innerHTML`), so typed text cannot inject HTML.
- CSV export prefixes cells that start with `=`, `+`, `-` or `@` so spreadsheets do not run them as formulas. CSV import checks every row and tells the user how many were skipped.

## Challenges I faced

- **No Codespace.** I ran out of my monthly Codespace hours, so I worked in a school Linux sandbox and edited through a VS Code tunnel in the browser, committing to GitHub from there.
- **Whisper on silence.** It returned made-up text for silent recordings. I added a minimum audio size and a filter for these phantom phrases.
- **Microphone needs https.** Browsers only allow the mic on secure pages. I used `localhost` while developing, then set up a real SSL certificate for the deployed site.
- **Upload size.** nginx rejected voice files at its default 1 MB limit until I raised `client_max_body_size`.
- **Sharing a load balancer.** lb-01 already had HAProxy and a certificate for another project. I backed up its config, added a separate certificate and a host-based rule, and checked that the old site still answered.
- **Bare servers.** The servers had no text editor or git, so I installed git and edited the HAProxy config with `sed` and `tee`.
- **Python 3.8.** The servers run Python 3.8, so the code and the pinned libraries had to work on it.
- **AI limits.** The free AI tier has rate limits and can be down, so I added the built-in backup reader so the app still works.
- **No database behind a load balancer.** Any server may answer any request, so the backend keeps no state. The ledger is stored in the browser and can be backed up as CSV.

## Known limitations

- The ledger is stored per browser and per device. It is not synced between devices; use the CSV backup to move it.
- Voice and typed entries are English only.
- The free Groq tier limits how many requests can be made per minute.
- The SSL certificate was issued on 2026-11-21 and expires on 2027-02-19 unless renewed.

## Credits

- **Groq** for the fast API that runs the models: https://console.groq.com/docs
- **OpenAI Whisper** (`whisper-large-v3`) for speech to text: https://github.com/openai/whisper
- **OpenAI gpt-oss-20b** (served by Groq) for turning sentences into entries: https://console.groq.com/docs/model/openai/gpt-oss-20b
- **Flask** https://flask.palletsprojects.com, **Gunicorn** https://gunicorn.org, **python-dotenv**, **Requests**
- **nginx** https://nginx.org/en/docs/, **HAProxy** https://docs.haproxy.org/, **Let's Encrypt and Certbot** https://letsencrypt.org/docs/
- **MDN Web Docs** for the MediaRecorder and getUserMedia APIs: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder

## Author

Lucky Umoka, Software Engineering, African Leadership University (Rwanda).