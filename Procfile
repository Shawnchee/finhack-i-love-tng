mule:     .venv/bin/python -m uvicorn mule_check_api.main:app --port 8000 --reload
layer3:   cd layer3-behavioral-fraud && ../.venv/bin/python -m uvicorn app.main:app --port 8083 --reload
scrape:   cd fraud_detect_api && ../.venv/bin/python -m uvicorn app.main:app --port 8082 --reload
frontend: cd frontend && npm run dev
