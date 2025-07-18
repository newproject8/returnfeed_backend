FROM python:3.9-slim
WORKDIR /app
RUN pip install websockets PyJWT
COPY main.py .
COPY relay_server.py .
COPY relay_server_secure.py .
# Keep using main.py for now to maintain compatibility
CMD ["python", "-u", "main.py"]