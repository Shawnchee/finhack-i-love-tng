FROM python:3.12-slim

WORKDIR /app

COPY mule_check_api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY mule_check_api/ ./mule_check_api/

EXPOSE 8000
CMD ["uvicorn", "mule_check_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
