# 🛒 E-commerce Platform with Docker and Kubernetes

A simple e-commerce platform built to demonstrate Docker containerization and Kubernetes load balancing.

(it is semi-broken but it worked for testing and learning basic kubernetes)

## 🔮 Features

- RESTful API for product management
- MongoDB database
- Docker containerization
- Kubernetes deployment with load balancing
- Health check endpoints

## 🔗 API Endpoints

- `GET /api/products` - List all products
- `GET /api/products/:id` - Get a single product
- `POST /api/products` - Create a new product
- `PUT /api/products/:id` - Update a product
- `DELETE /api/products/:id` - Delete a product
- `GET /health` - Health check endpoint

## 🐳 Running with Docker Compose

1. Build and start the containers:
   ```bash
   docker-compose up --build
   ```

2. The API will be available at `http://localhost:3000`

3. Stop the containers:
   ```bash
   docker-compose down
   ```

## 📦 Running with Kubernetes

1. Build the Docker image:
   ```bash
   docker build -t ecommerce-app .
   ```

2. Apply Kubernetes configurations:
   ```bash
   kubectl apply -f k8s/
   ```

3. Wait for the pods to be ready:
   ```bash
   kubectl get pods
   ```

4. Access the application:
   ```bash
   kubectl get service ecommerce-service
   ```
   The service will be available at the EXTERNAL-IP address on port 80.

5. Scale the application:
   ```bash
   kubectl scale deployment ecommerce-app --replicas=5
   ```

6. Clean up:
   ```bash
   kubectl delete -f k8s/
   ```

## 💾 Example Product Creation

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laptop",
    "description": "High-performance laptop",
    "price": 999.99,
    "stock": 10,
    "category": "electronics"
  }'
```

## 📂 Environment Variables

- `PORT` - Application port (default: 3000)
- `MONGODB_URI` - MongoDB connection string
- `NODE_ENV` - Node environment (development/production)

## 📓 Extra Notes:

The API and tester tool were developed with the assistance of AI to streamline the process and eliminate the need to build everything from scratch.

## 🤝 Contributing 

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License 

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.