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
  sudo install minikube-linux-amd64 /usr/local/bin/minikube 

$ # minikube via docker
$ # -------------------
$ \
  minikube start 

$ # or (prefered way)

$ # minikube bare metal
$ # -------------------
$ \
  sudo -i env \
   CHANGE_MINIKUBE_NONE_USER=true \
   MINIKUBE_HOME=$HOME \
   KUBECONFIG=$HOME/.kube/config \
   MINIKUBE_NODE_IP=192.168.1.57 \
   /usr/local/bin/minikube \
    --extra-config kubelet.node-ip=${MINIKUBE_NODE_IP} \
    start --driver=none

$ # verify ip is host ip
$ \
  minikube ip

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


# k0s
The simpeest way to install kubernetes is via https://k0sproject.io

## install
```
$ \
  curl -sSLf https://get.k0s.sh | sudo sh 
```

## start 'controller + worker' as system service
```
$\
  sudo k0s install controller --single
```

## start k0s
```
$ \
  sudo k0s start
```

## validate install
```
$ \
  sudo k0s status

Version: v1.21.2+k0s.0
Process ID: 6512
Parent Process ID: 1
Role: controller+worker
Init System: linux-systemd
Service file: /etc/systemd/system/k0scontroller.service


$ \
  sudo k0s kubectl get all --all-namespaces

NAMESPACE     NAME                                 READY   STATUS    RESTARTS   AGE
kube-system   pod/kube-proxy-ckctf                 1/1     Running   0          7m41s
kube-system   pod/kube-router-f86kd                1/1     Running   0          7m41s
kube-system   pod/coredns-5ccbdcc4c4-gsdcj         1/1     Running   0          7m47s
kube-system   pod/metrics-server-59d8698d9-vgbjl   1/1     Running   0          7m47s

NAMESPACE     NAME                     TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)                  AGE
default       service/kubernetes       ClusterIP   10.96.0.1      <none>        443/TCP                  8m3s
kube-system   service/kube-dns         ClusterIP   10.96.0.10     <none>        53/UDP,53/TCP,9153/TCP   7m47s
kube-system   service/metrics-server   ClusterIP   10.111.232.1   <none>        443/TCP                  7m47s

NAMESPACE     NAME                         DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR            AGE
kube-system   daemonset.apps/kube-proxy    1         1         1       1            1           kubernetes.io/os=linux   7m47s
kube-system   daemonset.apps/kube-router   1         1         1       1            1           <none>                   7m57s

NAMESPACE     NAME                             READY   UP-TO-DATE   AVAILABLE   AGE
kube-system   deployment.apps/coredns          1/1     1            1           7m47s
kube-system   deployment.apps/metrics-server   1/1     1            1           7m47s

NAMESPACE     NAME                                       DESIRED   CURRENT   READY   AGE
kube-system   replicaset.apps/coredns-5ccbdcc4c4         1         1         1       7m47s
kube-system   replicaset.apps/metrics-server-59d8698d9   1         1         1       7m47s
```

# kind (mini-kubernetes)

## install
```
$ \
  curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.11.1/kind-linux-amd64 &&\
  chmod +x ./kind &&\
  sudo mv ./kind /usr/local/bin/kind
```

## prepare cluster
```
$ \
  cat <<EOF | kind create cluster --config=-
---
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
- role: worker
- role: worker
- role: worker

EOF
```

## ingres

### traefik
```
$ \
  kubectl apply -f https://raw.githubusercontent.com/containous/traefik/v1.7/examples/k8s/traefik-rbac.yaml &&\
  kubectl apply -f https://raw.githubusercontent.com/containous/traefik/v1.7/examples/k8s/traefik-ds.yaml &&\
  kubectl apply -n kube-system -f - <<EOF
---
kind: Service
apiVersion: v1
metadata:
  name: traefik-ingress-service
  namespace: kube-system
spec:
  type: NodePort          # <-- 1. change the default ClusterIp to NodePort
  selector:
    k8s-app: traefik-ingress-lb
  ports:
  - protocol: TCP
    port: 80
    nodePort: 30100       # <-- 2. add this nodePort binding to one of the node ports exposed
    name: web
  - protocol: TCP
    port: 8080
    nodePort: 30101       # <-- 3. add this nodePort binding to another one of the node ports exposed
    name: admin
EOF
```

### nginx
```
$ \
  kubectl apply \
   -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/master/deploy/static/provider/kind/deploy.yaml
```

# budibase

## set config
```
$ \
  sudo chgrp $(id -g) /var/lib/k0s/pki/admin.conf &&\
  export KUBECONFIG=/var/lib/k0s/pki/admin.conf &&\
  alias k0s="sudo k0s" &&\
  alias kubectl="k0s kubectl"
```


# set default storage class
```
$ \ 
   kubectl  --namespace ${BUDIBASE_NS} apply -f pvc_standard.yam
   kubectl  --namespace ${BUDIBASE_NS} patch storageclass standard -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}' 
```

## install helm
```
$ \
  curl https://baltocdn.com/helm/signing.asc | sudo apt-key add - &&\
  sudo apt-get install apt-transport-https --yes &&\
  echo "deb https://baltocdn.com/helm/stable/debian/ all main" | sudo tee /etc/apt/sources.list.d/helm-stable-debian.list &&\
  sudo apt-get update &&\
  sudo apt-get install helm

$ \
  sudo helm version

version.BuildInfo{Version:"v3.6.1", GitCommit:"61d8e8c4a6f95540c15c6a65f36a6dd0a45e7a2f", GitTreeState:"clean", GoVersion:"go1.16.5"}
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

$ # -------------------------
# # set default storage class
$ # -------------------------

$ \
   kubectl  --namespace ${BUDIBASE_NS} apply -f pvc_standard.yaml &&\
   kubectl  --namespace ${BUDIBASE_NS} patch storageclass standard -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'

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

$ # TODO TODO TODO: kubectl runs as root and paths of plugins shoud point to HOME of root!!
% # this is a temp but funtional solution:

$ \
  sudo su -

root $ \ 
  BUDIBASE_NS=budibase &&\
  source hosting.properties &&\
  export KUBECONFIG=/var/lib/k0s/pki/admin.conf

root $ \
  (
  set -x; cd "$(mktemp -d)" &&
  OS="$(uname | tr '[:upper:]' '[:lower:]')" &&
  ARCH="$(uname -m | sed -e 's/x86_64/amd64/' -e 's/\(arm\)\(64\)\?.*/\1\2/' -e 's/aarch64$/arm64/')" &&
  curl -fsSLO "https://github.com/kubernetes-sigs/krew/releases/latest/download/krew.tar.gz" &&
  tar zxvf krew.tar.gz &&
  KREW=./krew-"${OS}_${ARCH}" &&
  "$KREW" install krew
 )"

root $ \
  export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"

$ # ----------------------
$ # install minio-operator
$ # ----------------------
root $ \
  kubectl krew install minio &&\
  kubectl minio init &&\
  kubectl minio tenant \
   create minio-tenant-1 \
    --servers 4 \
    --volumes 4 \
    --capacity 100M \
    --storage-class standard 

To open Operator UI, start a port forward using this command:

kubectl minio proxy -n minio-operator 

-----------------

Tenant 'minio-tenant-1' created in 'minio-operator' Namespace

  Username: admin 
  Password: xxxxxxxxxxxxx
  Note: Copy the credentials to a secure location. MinIO will not display these again.

+-------------+------------------------+----------------+--------------+--------------+
| APPLICATION | SERVICE NAME           | NAMESPACE      | SERVICE TYPE | SERVICE PORT |
+-------------+------------------------+----------------+--------------+--------------+
| MinIO       | minio                  | minio-operator | ClusterIP    | 443          |
| Console     | minio-tenant-1-console | minio-operator | ClusterIP    | 9443         |
+-------------+------------------------+----------------+--------------+--------------+

root $ # -------------
root $ # install minio
root $ # -------------
root $ \
  BUDIBASE_NS=${BUDIBASE_NS} \
  MINIO_ACCESS_KEY=$(echo -n ${MINIO_ACCESS_KEY} | base64) \
  MINIO_SECRET_KEY=$(echo -n ${MINIO_SECRET_KEY} | base64) \
   envsubst < budibase-minio-tenant.yaml | \
    kubectl apply \
     --namespace ${BUDIBASE_NS} -f -

$ # to check minio, use `kubectl minio proxy -n minio-operator`

$ \
  exit
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

NAME                                   READY   STATUS              RESTARTS   AGE
pod/budibase-app-7c68f49d88-8qgdm      0/1     ContainerCreating   0          10s
pod/budibase-couchdb-0                 1/1     Running             0          2m33s
pod/budibase-couchdb-1                 1/1     Running             0          2m33s
pod/budibase-couchdb-2                 1/1     Running             0          2m33s
pod/budibase-minio-ss-0-0              0/1     ContainerCreating   0          4s
pod/budibase-minio-ss-0-1              0/1     ContainerCreating   0          4s
pod/budibase-minio-ss-0-2              0/1     ContainerCreating   0          4s
pod/budibase-minio-ss-0-3              0/1     ContainerCreating   0          4s
pod/budibase-redis-master-0            1/1     Running             0          2m45s
pod/budibase-redis-replicas-0          1/1     Running             1          2m45s
pod/budibase-redis-replicas-1          1/1     Running             0          2m
pod/budibase-redis-replicas-2          1/1     Running             0          109s
pod/budibase-worker-7f4cf479bc-jvd6w   0/1     ContainerCreating   0          10s

NAME                              TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
service/budibase-app              ClusterIP   10.104.34.37     <none>        4002/TCP   10s
service/budibase-couchdb          ClusterIP   None             <none>        5984/TCP   2m33s
service/budibase-minio-hl         ClusterIP   None             <none>        9000/TCP   14s
service/budibase-redis-headless   ClusterIP   None             <none>        6379/TCP   2m45s
service/budibase-redis-master     ClusterIP   10.96.166.143    <none>        6379/TCP   2m45s
service/budibase-redis-replicas   ClusterIP   10.99.168.58     <none>        6379/TCP   2m45s
service/budibase-svc-couchdb      ClusterIP   10.110.116.155   <none>        5984/TCP   2m33s
service/budibase-worker           ClusterIP   10.110.115.250   <none>        4003/TCP   10s
service/minio                     ClusterIP   10.106.6.140     <none>        80/TCP     14s

NAME                              READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/budibase-app      0/1     1            0           10s
deployment.apps/budibase-worker   0/1     1            0           10s

NAME                                         DESIRED   CURRENT   READY   AGE
replicaset.apps/budibase-app-7c68f49d88      1         1         0       10s
replicaset.apps/budibase-worker-7f4cf479bc   1         1         0       10s

NAME                                       READY   AGE
statefulset.apps/budibase-couchdb          3/3     2m33s
statefulset.apps/budibase-minio-ss-0       0/4     4s
statefulset.apps/budibase-redis-master     1/1     2m45s
statefulset.apps/budibase-redis-replicas   3/3     2m45s
```

## external access

When you want to make a new site you have to go to `/builder/` which has to map to the `budibase-app`-service container in kubernetes. When finised building your site, Budibase installs the finished web-app in the `minio`-service in kubernetes in its own bucket and that bucket has to map to the root ('/') of your site.
All those mappings have to be specified in kubernetes in the ingres-controller with annotations.

```
$ \
# minikube addons enable ingress

$ # ---------------
$ # install traefik
$ # ---------------
$ \
  helm repo add traefik https://helm.traefik.io/traefik &&\
  helm repo update &&\
  helm install \
   --namespace ${BUDIBASE_NS} \
    traefik traefik/traefik

$ # dashboard
$ # ---------
$ \
  kubectl \
   --namespace ${BUDIBASE_NS} \
    port-forward \
     $(kubectl --namespace ${BUDIBASE_NS} get pods --selector "app.kubernetes.io/name=traefik" --output=name) \
      --address 0.0.0.0 \
       9000:9000
```
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
