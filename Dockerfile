# Используем официальный образ Node.js
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install --production && \
    npm cache clean --force

# Копируем остальные файлы
COPY . .

# Создаем папку для загрузок
RUN mkdir -p uploads && \
    chown -R node:node /app

# Переключаемся на пользователя node
USER node

# Открываем порт
EXPOSE 3002

# Запускаем приложение
CMD ["node", "server.js"]