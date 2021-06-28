  kubectl apply -n budibase  -f - <<EOF
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: couchdb
  annotations:
    kubernetes.io/ingress.class: traefik
spec:
  rules:
    - host: couchdb.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: budibase-couchdb
                port:
                  number: 5984
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: minio
  annotations:
    kubernetes.io/ingress.class: traefik
spec:
  rules:
    - host: minio.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: budibase-minio-hl
                port:
                  number: 9000
EOF
