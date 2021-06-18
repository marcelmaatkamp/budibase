# Hosting
The simplest way to start Budibase is to install docker and docker-compose and use the following command:

## docker + docker-compose
```
$ docker-compose up -d
```

## kubernetes
If you want to use Kubernetes use the following commands:

### mac
To install kubernets on a mac use https://microk8s.io 

(!!! NOTE !!!: this works up to the point containers want to talk to outside resources, couchdb fails to install properly in this setup when there are network problem but these are the steps I took)

```
$ brew install ubuntu/microk8s/microk8s
$ microk8s install &&\
  microk8s enable helm3 
 
$ alias helm="microk8s helm3"
$ alias kubectl="microk8s kubectl"
```

#### network
(!!! NOTE !!!: somebody suggested that this should be done in the host-os, which in microk8s is probably the 'multipass'-vm)
```
microk8s shell:
$ sudo iptables -P FORWARD ACCEPT
$ sudo apt-get update &&\
  sudo apt-get install iptables-persistent
```

### ubuntu
Installing kubernetes in ubuntu is simple, use the following commands to install Kubernetes on a local machine:
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
$ # set environment variables
$ \
  BUDIBASE_NS=budibase &&\
  source hosting.properties

$ # create namespace
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
    budibase-couchdb couchdb/couchdb

$ # -------------
$ # install minio
$ # -------------

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

$ # install minio-operator
$ \
  kubectl krew install minio &&\
  kubectl minio init &&\
  kubectl minio tenant \
   create minio-tenant-1 \
    --servers 1 \
    --volumes 1 \
    --capacity 100Mb \
    --storage-class standard 

$ # install minio in the namespace
$ \
  BUDIBASE_NS=${BUDIBASE_NS} \
  MINIO_ACCESS_KEY=$(echo -n ${MINIO_ACCESS_KEY} | base64) \
  MINIO_SECRET_KEY=$(echo -n ${MINIO_SECRET_KEY} | base64) \
   envsubst < budibase-minio-tenant.yaml | \
    kubectl apply \
     --namespace ${BUDIBASE_NS} -f -

$ # to check minio, use `kubectl minio proxy -n minio-operator`

$ # if everything went alright, the folling output should be visible
$ \
  $ kubectl --namespace ${BUDIBASE_NS} get all

NAME                                          READY   STATUS    RESTARTS   AGE
pod/budibase-couchdb-couchdb-0                1/1     Running   1          1h
pod/budibase-couchdb-couchdb-1                1/1     Running   1          1h
pod/budibase-couchdb-couchdb-2                1/1     Running   3          1h
pod/budibase-minio-console-8655458f4c-68qgj   1/1     Running   1          1h
pod/budibase-minio-console-8655458f4c-rnbnk   1/1     Running   1          1h
pod/budibase-minio-ss-0-0                     1/1     Running   1          1h
pod/budibase-minio-ss-0-1                     1/1     Running   1          1h
pod/budibase-minio-ss-0-2                     1/1     Running   1          1h
pod/budibase-minio-ss-0-3                     1/1     Running   1          1h
pod/budibase-redis-master-0                   1/1     Running   1          1h
pod/budibase-redis-replicas-0                 1/1     Running   2          1h
pod/budibase-redis-replicas-1                 1/1     Running   1          1h
pod/budibase-redis-replicas-2                 1/1     Running   1          1h

NAME                                   TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
service/budibase-couchdb-couchdb       ClusterIP   None             <none>        5984/TCP   1h
service/budibase-couchdb-svc-couchdb   ClusterIP   10.109.134.235   <none>        5984/TCP   1h
service/budibase-minio-console         ClusterIP   10.101.102.146   <none>        9090/TCP   1h
service/budibase-minio-hl              ClusterIP   None             <none>        9000/TCP   1h
service/budibase-redis-headless        ClusterIP   None             <none>        6379/TCP   1h
service/budibase-redis-master          ClusterIP   10.101.112.212   <none>        6379/TCP   1h
service/budibase-redis-replicas        ClusterIP   10.110.90.209    <none>        6379/TCP   1h
service/minio                          ClusterIP   10.105.144.240   <none>        80/TCP     1h

NAME                                     READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/budibase-minio-console   2/2     2            2           1h

NAME                                                DESIRED   CURRENT   READY   AGE
replicaset.apps/budibase-minio-console-8655458f4c   2         2         2       1h

NAME                                        READY   AGE
statefulset.apps/budibase-couchdb-couchdb   3/3     1h
statefulset.apps/budibase-minio-ss-0        4/4     1h
statefulset.apps/budibase-redis-master      1/1     1h
statefulset.apps/budibase-redis-replicas    3/3     1h
```

## budibase 
With couchdb, redis and minio installed succesfully, we can now install budibase
```
$ \
  sudo snap install kustomize

$ # install budibase  
$ \
  kustomize build kubernetes | \
   kubectl \
    --namespace ${BUDIBASE_NS} \
     apply -f -

### ingres routes
When you want to make a new site you have to go to `/builder/` which has to map to the `budibase-app`-service container in kubernetes. When finised building your site, Budibase installs the finished web-app in the `minio`-service in kubernetes in its own bucket and that bucket has to map to the root ('/') of your site.
All those mappings have to be specified in kubernetes in the ingres-controller with annotations.

(TBD: use nginx, traefik or kong, or maybe all of them)

The mappings are: 

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

### hostnames

| name | value | port | 
| -- | -- | -- |
| redis-master | budibase-redis-master.budibase.svc.cluster.local | |

## uninstall
```
$ \
 helm uninstall --namespace ${BUDIBASE_NS} budibase-redis &&\
 helm uninstall --namespace ${BUDIBASE_NS} budibase-couchdb &&\
 helm uninstall --namespace ${BUDIBASE_NS} budibase-minio
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


