# Use Node.js 18 Bullseye (Debian 11) which has good support for Python/C++
FROM node:18-bullseye

# Install Python 3, pip, and FFmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Node.js dependency files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy Python dependency files
COPY requirements.txt ./

# Install Python dependencies explicitly with PyTorch CPU to prevent huge CUDA downloads
RUN pip3 install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip3 install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3001

# Start the Node.js server
CMD ["node", "src/server.js"]
