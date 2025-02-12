# What was the process of deploying the application to Kubernetes?

1. First install docker, kubectl and minikube

```sh
# --- Docker ---
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \ $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# --- Kubectl ---

curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"

sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# --- Minikube ---

curl -LO https://github.com/kubernetes/minikube/releases/latest/download/minikube-linux-amd64

sudo install minikube-linux-amd64 /usr/local/bin/minikube && rm minikube-linux-amd64
```

2. Configure minikube to use docker as driver

```sh

sudo groupadd docker && sudo usermod -aG docker $USER && newgrp docker

minikube start --driver=docker --disk-size 5g
```

3. Run local docker registry

```sh
docker run -d -p 5000:5000 --restart=always --name registry registry:2
```

4. Build the docker image

```sh
docker build -t ecommerce-app .
```

5. Tag the image to push to the local registry

```sh
docker tag ecommerce-app localhost:5000/ecommerce-app
```

6. Push the image to the local registry

```sh
docker push localhost:5000/ecommerce-app
```

7. Apply the kubernetes configurations

```sh
kubectl apply -f k8s/
```

8. Wait for the pods to be ready

```sh
kubectl get pods
```

9. Setup tunnel to access the application (in a separate terminal)

```sh
minikube tunnel
```

10. See the service details

```sh
kubectl get service ecommerce-service
```

11. Using the EXTERNAL-IP address on port 80 access the application using the api tester tool

```sh
cd /.tools/api-tester
npm install
npm start
```

12. Scale the application if needed

```sh
kubectl scale deployment ecommerce-app --replicas=5
```

13. Clean up

```sh
kubectl delete -f k8s/
```

This process is not nessesarily the best way to deploy the application to kubernetes. It is just one way to do it. There are many other ways to deploy the application to kubernetes. The best way to deploy the application to kubernetes would depend on the requirements of the application and the infrastructure it is running on.

One extra thing to note is that the tunnel is there because minikube is running on a virtual machine. If minikube was running on a cloud provider like GCP or AWS, there would be no need for the tunnel. The service would be available at the EXTERNAL-IP address on port 80 without the need for a tunnel.
