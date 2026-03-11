# Use Node.js 18 Bullseye (Debian 11) which has good support for Python/C++
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

# Install Python dependencies
RUN pip3 install -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3001

# Start the Node.js server
CMD ["npm", "start"]
