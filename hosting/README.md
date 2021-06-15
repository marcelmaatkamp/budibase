# docker-compose
```
$ docker-compose up -d
```

# kubernetes

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

```
$ # set environment variables
$ BUDIBASE_NS=budibase
$ source hosting.properties

$ kubectl create namespace ${BUDIBASE_NS}

$ # install redis
$ helm repo add bitnami https://charts.bitnami.com/bitnami &&\
  helm repo update &&\
  helm install \
   --namespace ${BUDIBASE_NS} \
    budibase-redis bitnami/redis

$ # install couchdb
$ helm repo add couchdb https://apache.github.io/couchdb-helm &&\
  helm repo update &&\
  helm install \
   --namespace ${BUDIBASE_NS} \
    budibase-couchdb couchdb/couchdb

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
