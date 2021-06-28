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
EOF
