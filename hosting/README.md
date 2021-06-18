# Hosting
The simplest way to start Budibase is to install docker and docker-compose and use the following command:

## docker + docker-compose
```
$ docker-compose up -d
```

## kubernetes
If you want to use Kubernetes use the following commands:

### Ubuntu
Installing kubernetes in Ubuntu is simple, use the following commands to install Kubernetes on a local machine:
```
$ \
  curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64 &&\
  sudo install minikube-linux-amd64 /usr/local/bin/minikube &&\
  minikube start 

$ \
  sudo apt-get update &&\
  sudo apt-get install \
   kubectl &&\
  export KUBECONFIG=${HOME}/.kube/config

$ # disable sandbox (--devmode) so helm can access ${KUBECONFIG}
$ \
  sudo snap install helm3 --devmode &&\
  alias helm=helm3 
```

## couchdb, redis and minio
Now that kubernetes and tools are installed, we can install couchdb redis and minio
```
$ # -------------------------
$ # set environment variables
$ # -------------------------
$ \
  BUDIBASE_NS=budibase &&\
  source hosting.properties

$ # ----------------
$ # create namespace
$ # ----------------
$ \
  kubectl create namespace ${BUDIBASE_NS}

$ # -------------
$ # install redis
$ # -------------
$ # installation values for redis can be found at
$ #  - https://github.com/bitnami/charts/blob/master/bitnami/redis/values.yaml
$ \
  helm repo add bitnami https://charts.bitnami.com/bitnami &&\
  helm repo update &&\
  helm install \
   --namespace ${BUDIBASE_NS} \
   --set auth.password=${REDIS_PASSWORD} \
    budibase-redis bitnami/redis

$ # ---------------
$ # install couchdb
$ # ---------------
$ # installation values for couchdb can be found at
$ #  - https://apache.googlesource.com/couchdb-helm/+/refs/heads/main/couchdb/values.yaml
$ \
  helm repo add couchdb https://apache.github.io/couchdb-helm &&\
  helm repo update &&\
  helm install \
   --namespace ${BUDIBASE_NS} \
   --set couchdbConfig.couchdb.uuid=$(curl https://www.uuidgenerator.net/api/version4 2>/dev/null | tr -d -) \
   --set adminUsername=${COUCH_DB_USER} \
   --set adminPassword=${COUCH_DB_PASSWORD} \
    budibase couchdb/couchdb

$ # ------------
$ # install krew
$ # ------------
$ # install krew for kubectl
$ \
  (
  set -x; cd "$(mktemp -d)" &&
  OS="$(uname | tr '[:upper:]' '[:lower:]')" &&
  ARCH="$(uname -m | sed -e 's/x86_64/amd64/' -e 's/\(arm\)\(64\)\?.*/\1\2/' -e 's/aarch64$/arm64/')" &&
  curl -fsSLO "https://github.com/kubernetes-sigs/krew/releases/latest/download/krew.tar.gz" &&
  tar zxvf krew.tar.gz &&
  KREW=./krew-"${OS}_${ARCH}" &&
  "$KREW" install krew
 )

$ \
  export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"

$ # ----------------------
$ # install minio-operator
$ # ----------------------
$ \
  kubectl krew install minio &&\
  kubectl minio init &&\
  kubectl minio tenant \
   create minio-tenant-1 \
    --servers 1 \
    --volumes 1 \
    --capacity 100Mb \
    --storage-class standard 

$ # -------------
$ # install minio
$ # -------------
$ \
  BUDIBASE_NS=${BUDIBASE_NS} \
  MINIO_ACCESS_KEY=$(echo -n ${MINIO_ACCESS_KEY} | base64) \
  MINIO_SECRET_KEY=$(echo -n ${MINIO_SECRET_KEY} | base64) \
   envsubst < budibase-minio-tenant.yaml | \
    kubectl apply \
     --namespace ${BUDIBASE_NS} -f -

$ # to check minio, use `kubectl minio proxy -n minio-operator`
```

## budibase 
With couchdb, redis and minio installed succesfully, we can now install budibase
```
$ # ---------------- 
$ # install budibase 
$ # ---------------- 
$ \
  kubectl kustomize kubernetes | \
   kubectl \
    --namespace ${BUDIBASE_NS} \
     apply -f -
```

## verify 
if everything went alright, the folling output should be visible
```
$ \
  kubectl --namespace ${BUDIBASE_NS} get all

NAME                                          READY   STATUS    RESTARTS   AGE
pod/budibase-app-7c68f49d88-zx7b6             1/1     Running   0          14s
pod/budibase-couchdb-0                        1/1     Running   0          15m
pod/budibase-couchdb-1                        1/1     Running   0          15m
pod/budibase-couchdb-2                        1/1     Running   0          15m
pod/budibase-minio-console-8655458f4c-k75rq   1/1     Running   0          12m
pod/budibase-minio-console-8655458f4c-zz6k7   1/1     Running   0          12m
pod/budibase-minio-ss-0-0                     1/1     Running   0          13m
pod/budibase-minio-ss-0-1                     1/1     Running   0          13m
pod/budibase-minio-ss-0-2                     1/1     Running   0          13m
pod/budibase-minio-ss-0-3                     1/1     Running   0          13m
pod/budibase-redis-master-0                   1/1     Running   0          14m
pod/budibase-redis-replicas-0                 1/1     Running   1          14m
pod/budibase-redis-replicas-1                 1/1     Running   0          13m
pod/budibase-redis-replicas-2                 1/1     Running   0          13m
pod/budibase-worker-7f4cf479bc-vkx5z          1/1     Running   0          14s

NAME                              TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
service/budibase-app              ClusterIP   10.99.57.185     <none>        4002/TCP   14s
service/budibase-couchdb          ClusterIP   None             <none>        5984/TCP   15m
service/budibase-minio-console    ClusterIP   10.96.4.104      <none>        9090/TCP   12m
service/budibase-minio-hl         ClusterIP   None             <none>        9000/TCP   13m
service/budibase-redis-headless   ClusterIP   None             <none>        6379/TCP   14m
service/budibase-redis-master     ClusterIP   10.103.49.115    <none>        6379/TCP   14m
service/budibase-redis-replicas   ClusterIP   10.100.180.235   <none>        6379/TCP   14m
service/budibase-svc-couchdb      ClusterIP   10.103.72.21     <none>        5984/TCP   15m
service/budibase-worker           ClusterIP   10.111.113.199   <none>        4003/TCP   14s
service/minio                     ClusterIP   10.105.121.148   <none>        80/TCP     13m

NAME                                     READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/budibase-app             1/1     1            1           14s
deployment.apps/budibase-minio-console   2/2     2            2           12m
deployment.apps/budibase-worker          1/1     1            1           14s

NAME                                                DESIRED   CURRENT   READY   AGE
replicaset.apps/budibase-app-7c68f49d88             1         1         1       14s
replicaset.apps/budibase-minio-console-8655458f4c   2         2         2       12m
replicaset.apps/budibase-worker-7f4cf479bc          1         1         1       14s

NAME                                       READY   AGE
statefulset.apps/budibase-couchdb          3/3     15m
statefulset.apps/budibase-minio-ss-0       4/4     13m
statefulset.apps/budibase-redis-master     1/1     14m
statefulset.apps/budibase-redis-replicas   3/3     14m
```

### ingres routes
When you want to make a new site you have to go to `/builder/` which has to map to the `budibase-app`-service container in kubernetes. When finised building your site, Budibase installs the finished web-app in the `minio`-service in kubernetes in its own bucket and that bucket has to map to the root ('/') of your site.
All those mappings have to be specified in kubernetes in the ingres-controller with annotations.

(TBD: use nginx, traefik or kong, or maybe all of them)

The mappings are: 
```
$ # set routes 
$ # App:
$ #  path:   "/"           budibase-app
$ #  prefix: "/app/"       budibase-app,     prefix_rewrite: "/"
$ #  prefix: "/app_"       budibase-app
$ #  prefix: "/builder"    budibase-app
$ #  prefix: "/builder/"   budibase-app
$ #  prefix: "/api/"       budibase-app

$ # Worker:
$ #  prefix: "/api/admin/" budibase-worker
$ #  prefix: "/worker/"    budibase-worker,  prefix_rewrite: "/"

# $ Couchdb
$ #  prefix: "/db/"        couchdb, prefix_rewrite: "/"

# $ Minio
$ #  prefix: "/"           minio

`nginx.ingress.kubernetes.io/rewrite-target: /`
```

## uninstall
To uninstall all budibase,minio,couchdb and redis 
```
$ # -----------------
$ # delete everything
$ # -----------------
$ \
  kustomize build kubernetes | \
   kubectl \
    --namespace ${BUDIBASE_NS} \
     delete -f - &&\
  helm uninstall --namespace ${BUDIBASE_NS} budibase-redis &&\
  helm uninstall --namespace ${BUDIBASE_NS} budibase-couchdb &&\
  BUDIBASE_NS=${BUDIBASE_NS} \
  MINIO_ACCESS_KEY=$(echo -n ${MINIO_ACCESS_KEY} | base64) \
  MINIO_SECRET_KEY=$(echo -n ${MINIO_SECRET_KEY} | base64) \
   envsubst < budibase-minio-tenant.yaml | \
    kubectl delete \
     --namespace ${BUDIBASE_NS} -f -

$ # check that all resources are removed
$ \
  kubectl --namespace ${BUDIBASE_NS} get all

No resources found in budibase namespace.
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

## hostnames

| name | value | port |
| -- | -- | -- |
| redis-master | budibase-redis-master.budibase.svc.cluster.local | |
