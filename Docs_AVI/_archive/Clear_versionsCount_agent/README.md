# Limpieza de versions en agente (LibreChat)

## Contexto del problema
Al actualizar system prompt o instrucciones de un agente, puede ocurrir error cuando el historial de versiones (`versions`) crece demasiado.

En este caso se detecto un agente con `versionsCount: 15`, y la solucion fue podar el historial para dejar solo las ultimas 5 versiones.

## Solucion aplicada (mongosh)

1. Contar versiones del agente puntual:

```javascript
db.agents.aggregate([{ $match: { id: "agent_sZT_zwg0DxMN39gTemMss" } }, { $project: { _id: 0, id: 1, name: 1, versionsCount: { $size: { $ifNull: ["$versions", []] } } } }])
```

2. Dejar solo las ultimas 5 versiones:

```javascript
db.agents.updateOne({ id: "agent_sZT_zwg0DxMN39gTemMss" }, [{ $set: { versions: { $slice: ["$versions", -5] } } }])
```

## Verificacion recomendada
Volver a ejecutar el aggregate y confirmar que `versionsCount` quedo en `5`.
