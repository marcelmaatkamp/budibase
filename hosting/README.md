# docker-compose
```
$ docker-compose up -d
```

# kubernetes
```
$ # install redis
$ helm repo add bitnami https://charts.bitnami.com/bitnami &&\
  helm repo update &&\
  helm install budibase-redis bitnami/redis

$ # install couchdb
$ helm repo add couchdb https://apache.github.io/couchdb-helm &&\
  helm repo update &&\
  helm install budibase-couchdb couchdb/couchdb

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
$ kubectl apply \
   -f https://github.com/minio/operator/blob/master/examples/tenant-lite.yaml

$ # OR install minio via helm (deprecated)
$ helm repo add minio https://helm.min.io &&\
  helm repo update &&\
  helm install \
   --set \
    accessKey=budibase,\
    secretKey=budibase \
   budibase-minio minio/minio

$ # install budibase  
$ kustomize build kubernetes | kubectl apply -f -

$ # set routes
$
```
