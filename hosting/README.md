# Hosting
The simplest way to start Budibase is to install docker and docker-compose and use the following command:

## docker + docker-compose
```
$ docker-compose up -d
```

## kubernetes
If you want to use Kubernetes use the following commands:

### kind (mini-kubernetes)

#### install
```
$ \
  curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.11.1/kind-linux-amd64 &&\
  chmod +x ./kind &&\
  sudo mv ./kind /usr/local/bin/kind
```

#### prepare cluster
1 control plane plus 3 workers

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
  - containerPort: 30100
    hostPort: 30100
  - containerPort: 30101
    hostPort: 30101
  - containerPort: 30102
    hostPort: 30102
- role: worker
- role: worker
- role: worker
EOF
```

### install traefik
```
$ \
  kubectl create namespace traefik &&\
  kubectl apply -f - <<EOF
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: traefik-config
  namespace: traefik
data:
  traefik-config.yaml: |
    http:
      middlewares:
        headers-default:
          headers:
            sslRedirect: true
            browserXssFilter: true
            contentTypeNosniff: true
            forceSTSHeader: true
            stsIncludeSubdomains: true
            stsPreload: true
            stsSeconds: 15552000
            customFrameOptionsValue: SAMEORIGIN
EOF
  cat <<EOF > traefik-chart-values.yaml
additionalArguments:
  - --providers.file.filename=/data/traefik-config.yaml
  - --entrypoints.websecure.http.tls.domains[0].main=example.com
  - --entrypoints.websecure.http.tls.domains[0].sans=*.example.com
ports:
  web:
    redirectTo: websecure
ingressRoute:
  dashboard:
    enabled: false
persistence:
  enabled: true
  path: /certs
  size: 128Mi
volumes:
  - mountPath: /data
    name: traefik-config
    type: configMap
EOF

  helm repo add traefik https://helm.traefik.io/traefik &&\
  helm repo update &&\
  helm install traefik traefik/traefik --namespace=traefik --values=traefik-chart-values.yaml
```

### install loadbalancer
MetalLB is a load-balancer implementation for bare metal Kubernetes clusters, using standard routing protocols.
See https://metallb.universe.tf

```
$ \
  DOCKER_KIND_SUBNET=$(docker network inspect kind -f "{{(index .IPAM.Config 0).Subnet}}" | cut -d '.' -f1,2) &&\
  kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.10.2/manifests/namespace.yaml &&\
  cm=$(kubectl apply -f - <<EOF
---
apiVersion: v1
kind: ConfigMap
metadata:
  namespace: metallb-system
  name: config
data:
  config: |
    address-pools:
    - name: default
      protocol: layer2
      addresses:
      - $DOCKER_KIND_SUBNET.255.1-$DOCKER_KIND_SUBNET.255.250
EOF
  ) &&\
  kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.10.2/manifests/metallb.yaml &&\
  kubectl create secret generic -n metallb-system memberlist --from-literal=secretkey="$(openssl rand -base64 128)"
```

### install traefik dashboard
```
$ \
  username=admin &&\
  password=password &&\
  decoded_username_passwd=$(docker run --rm marcnuri/htpasswd -nb ${username} ${password} | openssl base64) &&\
  kubectl apply -f - <<EOF
---
apiVersion: v1
kind: Secret
metadata:
  name: traefik-dashboard-auth
  namespace: traefik
data:
  users: |2
    ${decoded_username_passwd}
---
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: traefik-dashboard-basicauth
  namespace: traefik
spec:
  basicAuth:
    secret: traefik-dashboard-auth
---
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: traefik-dashboard
  namespace: traefik
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host("traefik.example.com")
      kind: Rule
      middlewares:
        - name: traefik-dashboard-basicauth
          namespace: traefik
      services:
        - name: api@internal
          kind: TraefikService
EOF
  kubectl apply -f - <<EOF
---
apiVersion: v1
kind: Service
metadata:
  name: traefik-web-ui
spec:
  selector:
    k8s-app: traefik-ingress-lb
  ports:
  - port: 80
    targetPort: 8080
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: traefik-web-ui
  annotations:
    kubernetes.io/ingress.class: traefik
spec:
  rules:
   - host: traefik.example.com
     http:
      paths:
       - path: /
         pathType: Prefix
         backend:
          service:
           name: traefik-web-ui
           port:
            number: 80
EOF
```

### install webserver
```
  kubectl create deployment web --image=nginx &&\
  kubectl expose deployment web --port=80 &&\
  kubectl apply -f - <<EOF
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-test
  annotations:
    kubernetes.io/ingress.class: traefik
spec:
  rules:
    - host: www.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
EOF
```

### test configuration
```
LB=$(kubectl get svc -n traefik traefik -o jsonpath='{.status.loadBalancer.ingress[0].ip}' )
curl -k -H "Host: www.example.com" https://${LB}
curl -k -H "Host: traefik.example.com" https://${LB}
```

or 
```
kind (192.168.1.1) $ \
  kubectl port-forward --address 0.0.0.0 -n traefik service/traefik 8443:443

other (192.168.1.2) $ \
  curl -k -H 'Host: www.example.com' 192.168.1.1
```

# budibase

## install couchdb, redis and minio

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

## hosts
```
$ \
  kubectl port-forward --address 0.0.0.0 -n traefik service/traefik 8443:443
```

/etc/hosts
```
<ip_of_kind_host>  www.example.com traefik.example.com couchdb.example.com minio.example.com budibase.example.com
```

| name | url |
| --- | --- |
| test webserver | https://www.example.com |
| traefik dashboard | https://traefik.example.com |
| couchdb web gui | https://couchdb.example.com/_utils |
| minio | https://minio.example.com/_utils |

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
```

## external access

When you want to make a new site you have to go to `/builder/` which has to map to the `budibase-app`-service container in kubernetes. When finised building your site, Budibase installs the finished web-app in the `minio`-service in kubernetes in its own bucket and that bucket has to map to the root ('/') of your site.
All those mappings have to be specified in kubernetes in the ingres-controller with annotations.

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
