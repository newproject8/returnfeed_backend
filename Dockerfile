# 1. Base Image
FROM node:18-alpine

# 2. Working Directory
WORKDIR /usr/src/app

# 3. Copy package.json and package-lock.json
COPY package*.json ./

# 4. Install Dependencies
# 소스 코드 변경 시 매번 재설치하지 않도록 npm install을 먼저 실행합니다.
RUN npm install

# 5. Copy Source Code
# docker-compose에서 볼륨 마운트를 사용하므로 Dockerfile에서는 복사하지 않습니다.
# COPY . .

# 6. Expose Port and Define Default Command
EXPOSE 3001
CMD [ "npm", "run", "dev" ]