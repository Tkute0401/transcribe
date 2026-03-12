# Use Node.js 18 Bullseye (Debian 11)
FROM node:18-bullseye

# Install Python 3, pip, and FFmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
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

# Install Python dependencies explicitly with PyTorch CPU
RUN pip3 install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip3 install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Ensure the uploads directory exists
RUN mkdir -p uploads

# Expose the port the app runs on
EXPOSE 3001

# Start the Node.js server using direct node command
# Using full path to node just to be absolutely sure
CMD ["/usr/local/bin/node", "src/server.js"]
