# Hosting
The simplest way to start Budibase is to install docker and docker-compose and use the following command:

## docker + docker-compose
```
$ docker-compose up -d
```

## kubernetes
If you want to use Kubernetes use the following commands:

## Microk8s
https://microk8s.io

### mac
```
$ brew install ubuntu/microk8s/microk8s
$ microk8s install &&\
  microk8s enable helm3 
 
$ alias helm="microk8s helm3"
$ alias kubectl="microk8s kubectl"
```

<<<<<<< HEAD
### ubuntu
```
$ sudo apt-get update &&\
  sudo apt-get install \
   kubeadm kubelet kubectl 

$ # disable sandbox (--devmode) so helm can access ${HOME}/.kube/config
$ sudo snap install helm3 --devmode &&\
  alias helm=helm3 &&\
  export KUBECONFIG=${HOME}/.kube/config

$ curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64 &&\
  sudo install minikube-linux-amd64 /usr/local/bin/minikube &&\
  minikube start
=======
#### network
```
microk8s shell:
$ sudo iptables -P FORWARD ACCEPT
$ sudo apt-get update && apt-get install iptables-persistent
>>>>>>> ae966540287914ae399bde83be12ef46112b81a0
```

## kubernetes

```
$ # set environment variables
$ BUDIBASE_NS=budibase
$ source hosting.properties

$ # create namespace
$ kubectl create namespace ${BUDIBASE_NS}

$ # install redis
$ # 
$ # installation values can be found at
$ #  https://github.com/bitnami/charts/blob/master/bitnami/redis/values.yaml
$ # 
$ helm repo add bitnami https://charts.bitnami.com/bitnami &&\
  helm repo update &&\
  helm install \
   --namespace ${BUDIBASE_NS} \
   --set auth.password=${REDIS_PASSWORD} \
    budibase-redis bitnami/redis

$ # redis hostname: budibase-redis-master.budibase.svc.cluster.local

$ # install couchdb
$ # 
$ # installation values can be found at
$ #  https://apache.googlesource.com/couchdb-helm/+/refs/heads/main/couchdb/values.yaml
$ #
$ helm repo add couchdb https://apache.github.io/couchdb-helm
  helm repo update
  helm install \
   --namespace ${BUDIBASE_NS} \
   --set couchdbConfig.couchdb.uuid=$(curl https://www.uuidgenerator.net/api/version4 2>/dev/null | tr -d -) \
   --set adminUsername=${COUCH_DB_USER} \
   --set adminPassword=${COUCH_DB_PASSWORD} \
    budibase-couchdb couchdb/couchdb

$ # check status with
$ kubectl get pods --namespace budibase -l "app=couchdb,release=budibase-couchdb"
$ # Once all of the Pods are fully Ready, execute the following command to create
$ # some required system databases:

$ kubectl exec --namespace budibase -it budibase-couchdb-couchdb-0 -c couchdb -- bash
 % curl -X PUT  http://budibase:budibase@localhost:5984/_users; \
   curl -X PUT  http://budibase:budibase@localhost:5984/_replicator; \
   curl -X PUT  http://budibase:budibase@localhost:5984/_global_changes; \
   curl -X POST http://budibase:budibase@localhost:5984/_cluster_setup \
    -H "Content-Type: application/json" \
    -d '{"action": "finish_cluster"}'

$ kubectl exec --namespace budibase -it budibase-couchdb-couchdb-0 -c couchdb -- \
    curl -s \
    http://127.0.0.1:5984/_cluster_setup \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"action": "finish_cluster"}' \
    -u ${COUCH_DB_USER}

$ # install minio/operator via krew
$ ## install krew for kubectl
$ kubectl krew install minio
$ kubectl minio init
$ kubectl minio tenant \
   create minio-tenant-1 \
    --servers 1 \
    --volumes 1 \
    --capacity 100Mb \
    --storage-class standard 
$ kubectl apply 
   --namespace ${BUDIBASE_NS} \
   -f https://github.com/minio/operator/blob/master/examples/tenant-lite.yaml

$ # OR install minio via helm (deprecated)
$ helm repo add minio https://helm.min.io &&\
  helm repo update &&\
  helm install \a
   --namespace ${BUDIBASE_NS} \
   --set \
    accessKey=budibase,\
    secretKey=budibase \
   budibase-minio minio/minio

$ # install budibase  
$ kustomize build kubernetes | \
   kubectl \
    --namespace ${BUDIBASE_NS} \
     apply -f -

$ # set routes 
$ # App:
$ #  path:   "/"           app-service
$ #  prefix: "/app/"       app-service,     prefix_rewrite: "/"
$ #  prefix: "/app_"       app-service
$ #  prefix: "/builder"    app-service
$ #  prefix: "/builder/"   app-service
$ #  prefix: "/api/"       app-service

$ # Worker:
$ #  prefix: "/api/admin/" worker-service
$ #  prefix: "/worker/"    worker-service,  prefix_rewrite: "/"

# $ Couchdb
$ #  prefix: "/db/"        couchdb-service, prefix_rewrite: "/"

# $ Minio
$ #  prefix: "/"           minio-service

    nginx.ingress.kubernetes.io/rewrite-target: /
```

## uninstall
```
$ helm uninstall --namespace ${BUDIBASE_NS} budibase-couchdb 
```

## variables

| name                 | values     |
| -------------------- | ---------- |
| MAIN_PORT            | 10000      |
| JWT_SECRET           | testsecret |
| MINIO_ACCESS_KEY     | budibase   |
| MINIO_SECRET_KEY     | budibase   |
| COUCH_DB_PASSWORD    | budibase   |
| COUCH_DB_USER        | budibase   |
| REDIS_PASSWORD       | budibase   |
| INTERNAL_API_KEY     | budibase   |
| APP_PORT             | 4002       |
| WORKER_PORT          | 4003       |
| MINIO_PORT           | 4004       |
| COUCH_DB_PORT        | 4005       |
| REDIS_PORT           | 6379       |
| BUDIBASE_ENVIRONMENT | PRODUCTION |


