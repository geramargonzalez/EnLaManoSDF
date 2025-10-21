# Quick Setup Guide - Equifax Environment Switcher

## 🚀 Setup Rápido (5 minutos)

### 1️⃣ Agregar Script Parameters

Copiá y pegá estos parámetros en tu Script:

```javascript
// En el archivo de script, agregar estos comentarios para documentar:
/**
 * Script Parameters:
 * 
 * @NScriptParam {string} custscript_equifax_environment - Environment (SANDBOX/PRODUCTION)
 * @NScriptParam {string} custscript_equifax_sb_client_id - Sandbox Client ID
 * @NScriptParam {string} custscript_equifax_sb_client_secret - Sandbox Client Secret
 * @NScriptParam {string} custscript_equifax_prod_client_id - Production Client ID
 * @NScriptParam {string} custscript_equifax_prod_client_secret - Production Client Secret
 */
```

### 2️⃣ Valores Iniciales (SANDBOX)

En tu Script Deployment, configurá:

| Parameter | Value |
|-----------|-------|
| **Environment** | `SANDBOX` |
| **SB Client ID** | `VpixfB4T0M0XB04LCaQV3xU3ZlgwmAQT` |
| **SB Client Secret** | `PSbTJjjUOW8ItvgR` |
| **PROD Client ID** | *(dejar vacío por ahora)* |
| **PROD Client Secret** | *(dejar vacío por ahora)* |

### 3️⃣ Test de Conexión

Ejecutá este código en la consola del browser inspector:

```javascript
require(['N/https'], function(https) {
    var response = https.post({
        url: 'https://api.sandbox.equifax.com/v2/oauth/token',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic VnBpeGZCNFQwTTBYQjA0TENhUVYzeFUzWmxnd21BUVRQU2JUSmpqVU9XOEl0dmdS'
        },
        body: 'grant_type=client_credentials&scope=https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations'
    });
    
    console.log('Token Response:', response.code);
    console.log('Body:', response.body);
});
```

✅ Si obtenés `code: 200`, está funcionando!

---

## 🔄 Cambiar a PRODUCCIÓN (cuando esté listo)

### Paso 1: Obtener Credenciales PROD

Contactá a tu Account Manager de Equifax para obtener:
- Production Client ID
- Production Client Secret

### Paso 2: Actualizar Parameters

En el Script Deployment:

| Parameter | Value |
|-----------|-------|
| **Environment** | `PRODUCTION` |
| **PROD Client ID** | `[tu client id de prod]` |
| **PROD Client Secret** | `[tu client secret de prod]` |

### Paso 3: Invalidar Caché

Después de cambiar el ambiente, ejecutá:

```javascript
// Desde un Suitelet o User Event Script
require(['../adapters/equifaxAdapter'], function(equifaxAdapter) {
    equifaxAdapter.invalidateTokenCache();
    log.audit('Cache Invalidated', 'Token cache cleared for environment switch');
});
```

O usá el **Equifax Tester Suitelet** que creamos.

---

## 🧪 Usar el Tester Suitelet

### Deploy del Tester

1. Subí `equifaxTester.js` a NetSuite
2. Create Script Record:
   - **Type**: Suitelet
   - **Name**: Equifax Environment Tester
   - **File**: `equifaxTester.js`
3. Deploy con los mismos parameters que el script principal
4. Asigná un **Role** para acceso

### Funciones del Tester

- ✅ Ver ambiente activo (SANDBOX/PRODUCTION)
- ✅ Ver URL de API en uso
- ✅ Probar consulta con documento de prueba
- ✅ Invalidar caché de token
- ✅ Ver tiempos de respuesta

---

## 📋 Checklist de Go-Live

Antes de pasar a PRODUCCIÓN:

- [ ] Credenciales PROD configuradas en Script Parameters
- [ ] Parámetro `environment` cambiado a `PRODUCTION`
- [ ] Caché de token invalidado después del cambio
- [ ] Test exitoso con documento real en PROD
- [ ] Logs de auditoría revisados (debe decir "PRODUCTION")
- [ ] Monitoreo de errores activado
- [ ] Rollback plan documentado

---

## 🛡️ Seguridad

### DO ✅
- Usar Script Parameters de tipo **Password** para secrets
- Habilitar **Mask in Log** para todos los secrets
- Restringir acceso al Tester Suitelet (solo Admins)
- Rotar credenciales periódicamente

### DON'T ❌
- Hardcodear credenciales en el código
- Loguear tokens o secrets completos
- Compartir credenciales de PROD por email/chat
- Dejar PROD activo en ambientes de testing

---

## 📊 Monitoring

### Logs a Revisar

```javascript
// Al inicializar (debe aparecer en cada ejecución del script)
AUDIT | Equifax Config Initialized | Environment: SANDBOX (SANDBOX)
```

### KPIs de Performance

- **Token fetch**: < 2 segundos
- **API request**: < 15 segundos
- **Cache hit rate**: > 95% (después de primer request)

### Alertas Recomendadas

- ⚠️ > 5 errores 401 consecutivos → Verificar credenciales
- ⚠️ > 10 errores 500 en 1 hora → Problema en Equifax
- ⚠️ Tiempo de respuesta > 30s → Timeout muy alto

---

## 🆘 Rollback Rápido

Si algo sale mal en PRODUCCIÓN:

```
1. Ve al Script Deployment
2. Cambiá custscript_equifax_environment de PRODUCTION a SANDBOX
3. Guardá
4. Invalidá caché (usar Tester Suitelet)
5. Verificá logs: debe decir "Environment: SANDBOX"
```

Tiempo estimado: **< 2 minutos**

---

## 📞 Soporte

### Equifax Support
- Email: support@equifax.com  
- Phone: [número de soporte]
- Horario: Lun-Vie 9am-6pm (hora local)

### Documentación Oficial
- API Docs: https://developer.equifax.com
- Authentication: https://developer.equifax.com/oauth

---

**Versión**: 1.0  
**Última actualización**: Octubre 2025  
**Maintainer**: ELM Development Team
