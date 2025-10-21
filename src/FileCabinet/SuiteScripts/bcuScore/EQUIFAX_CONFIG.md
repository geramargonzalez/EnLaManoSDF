# Configuración Equifax - Sandbox vs Producción

## 📋 Script Parameters Requeridos

Para switchear entre **Sandbox** y **Producción**, configurá los siguientes Script Parameters en NetSuite:

### 🔧 Parámetros Obligatorios

| Parameter ID | Label | Type | Default Value | Descripción |
|-------------|-------|------|---------------|-------------|
| `custscript_equifax_environment` | **Equifax Environment** | List/Record | `SANDBOX` | Ambiente activo: `SANDBOX` o `PRODUCTION` |

### 🔑 Credenciales SANDBOX

| Parameter ID | Label | Type | Value |
|-------------|-------|------|-------|
| `custscript_equifax_sb_client_id` | **Equifax SB Client ID** | Free-Form Text | `VpixfB4T0M0XB04LCaQV3xU3ZlgwmAQT` |
| `custscript_equifax_sb_client_secret` | **Equifax SB Client Secret** | Password | `PSbTJjjUOW8ItvgR` |

### 🔐 Credenciales PRODUCCIÓN

| Parameter ID | Label | Type | Value |
|-------------|-------|------|-------|
| `custscript_equifax_prod_client_id` | **Equifax PROD Client ID** | Free-Form Text | *(Obtener de Equifax)* |
| `custscript_equifax_prod_client_secret` | **Equifax PROD Client Secret** | Password | *(Obtener de Equifax)* |

### 🎯 Parámetros Opcionales (BOX_FASE0_PER)

Estos parámetros tienen valores por defecto, pero pueden sobrescribirse:

| Parameter ID | Label | Type | Default |
|-------------|-------|------|---------|
| `custscript_equifax_billto` | **Equifax Bill To** | Free-Form Text | `UY004277B001` |
| `custscript_equifax_shipto` | **Equifax Ship To** | Free-Form Text | `UY004277B001S3642` |
| `custscript_equifax_product_name` | **Equifax Product Name** | Free-Form Text | `UYICBOX` |
| `custscript_equifax_product_orch` | **Equifax Product Orch** | Free-Form Text | `boxFase0Per` |
| `custscript_equifax_customer` | **Equifax Customer** | Free-Form Text | `UYICMANDAZY` |
| `custscript_equifax_model` | **Equifax Model** | Free-Form Text | `boxFase0PerMandazy` |
| `custscript_equifax_configuration` | **Equifax Configuration** | Free-Form Text | `Config` |

---

## 🌐 URLs por Ambiente

### SANDBOX
```
Token URL:  https://api.sandbox.equifax.com/v2/oauth/token
API URL:    https://api.sandbox.equifax.com/business/interconnect/v1/decision-orchestrations/execute
```

### PRODUCCIÓN
```
Token URL:  https://api.latam.equifax.com/v2/oauth/token
API URL:    https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations/execute
```

---

## 🚀 Cómo Configurar en NetSuite

### Paso 1: Crear Script Parameters

1. Ve a **Customization > Scripting > Scripts**
2. Abrí el script que usa `equifaxAdapter.js` (ej: `ELM_SCORE_BCU_LIB.js`)
3. En la pestaña **Parameters**, hacé clic en **New**
4. Creá cada parámetro según la tabla de arriba

### Paso 2: Configurar List/Record para Environment

Para `custscript_equifax_environment`:

1. **Type**: List/Record
2. **List Values**:
   - `SANDBOX` → Display: "Sandbox (Testing)"
   - `PRODUCTION` → Display: "Production"
3. **Default Value**: `SANDBOX`

### Paso 3: Configurar Passwords

Para `custscript_equifax_sb_client_secret` y `custscript_equifax_prod_client_secret`:

1. **Type**: Password
2. **Mask in Log**: ✅ Habilitado
3. Ingresá el valor del secret **sin comillas**

### Paso 4: Deploy Script

1. Guardá el script
2. Ve a **Deployments**
3. Editá el deployment activo
4. Configurá los valores de los parámetros:
   - Para **SANDBOX**: dejá `SANDBOX` en `custscript_equifax_environment`
   - Para **PRODUCTION**: cambiá a `PRODUCTION`

---

## 🔄 Switchear entre Ambientes

### Opción A: Cambiar en el Deployment (Recomendado)

1. Ve al **Script Deployment**
2. Editá el parámetro `custscript_equifax_environment`
3. Seleccioná `SANDBOX` o `PRODUCTION`
4. Guardá

### Opción B: Crear Deployments Separados

Podés tener dos deployments del mismo script:

- **Deploy 1**: `ELM Score BCU - SANDBOX`
  - `custscript_equifax_environment` = `SANDBOX`
  
- **Deploy 2**: `ELM Score BCU - PRODUCTION`
  - `custscript_equifax_environment` = `PRODUCTION`

Luego activás/desactivás según necesites.

---

## 🧪 Testing

### Test en Sandbox

```javascript
// El código automáticamente usa Sandbox si el parámetro está en SANDBOX
const result = equifaxAdapter.fetch('12345678');
// Usa: https://api.sandbox.equifax.com/...
```

### Test en Producción

```javascript
// Solo cambiá el parámetro a PRODUCTION en el deployment
const result = equifaxAdapter.fetch('12345678');
// Usa: https://api.latam.equifax.com/...
```

---

## 📊 Logs de Auditoría

El adapter loguea el ambiente activo al inicializarse:

```
AUDIT | Equifax Config Initialized | Environment: SANDBOX (SANDBOX)
AUDIT | Equifax Config Initialized | Environment: PRODUCTION (PRODUCTION)
```

Revisá los **Execution Logs** para confirmar qué ambiente está activo.

---

## ⚠️ Consideraciones Importantes

### Seguridad
- **NUNCA** hardcodees credenciales de producción en el código
- Usá siempre Script Parameters de tipo **Password** para secrets
- Habilitá **Mask in Log** para todos los secrets

### Performance
- El adapter cachea el token por 55 minutos
- Cambiar el ambiente requiere re-deploy o invalidar caché

### Transición a Producción
1. Obtené credenciales de producción de Equifax
2. Configurá `custscript_equifax_prod_client_id` y `custscript_equifax_prod_client_secret`
3. Probá en un deployment de test primero
4. Cambiá `custscript_equifax_environment` a `PRODUCTION`
5. Monitoreá los logs para confirmar

---

## 🆘 Troubleshooting

### Error: "Credenciales Equifax no configuradas para ambiente: PRODUCTION"
**Causa**: Faltan las credenciales de producción  
**Solución**: Configurá `custscript_equifax_prod_client_id` y `custscript_equifax_prod_client_secret`

### Error: "Token request failed: 401"
**Causa**: Client ID o Secret incorrecto  
**Solución**: Verificá las credenciales en el Script Parameter

### No switchea de ambiente
**Causa**: Caché de configuración  
**Solución**: Re-deploy el script o reiniciá el execution context

---

## 📞 Contacto

Si tenés dudas sobre las credenciales de producción, contactá a:
- **Equifax Support**: support@equifax.com
- **Account Manager**: (tu contacto en Equifax)

---

**Última actualización**: Octubre 2025  
**Versión**: 1.0
