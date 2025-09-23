# Sistema de Alertas de Edición Concurrente para Leads

## Descripción
Este sistema detecta y alerta a los usuarios cuando múltiples personas están editando simultáneamente Leads con el mismo número de documento en NetSuite, ayudando a prevenir conflictos de datos y asegurar la integridad de la información.

## Archivos del Sistema

### 1. ELM_ConcurrentEditAlert_CS.js (Client Script)
**Tipo**: Client Script  
**Descripción**: Script del lado del cliente que monitorea en tiempo real si otros usuarios están editando Leads con el mismo número de documento.

**Funcionalidades**:
- Verificación automática cada 30 segundos durante la edición
- Alerta visual en la parte superior de la página cuando se detecta edición concurrente
- Detección de cambios en el número de documento para actualizar la verificación
- Cleanup automático al guardar o salir de la página

### 2. ELM_ConcurrentEditAlert_UE.js (User Event Script)
**Tipo**: User Event Script  
**Descripción**: Script del lado del servidor que registra actividades de edición y agrega el Client Script a los formularios de Lead.

**Funcionalidades**:
- Inyección automática del Client Script en formularios de edición de Leads
- Detección de cambios concurrentes antes de guardar
- Registro de advertencias en los comentarios del Lead
- Logging de actividades para auditoría

## Configuración en NetSuite

### Paso 1: Subir los Archivos
1. Navegue a **Customization > Scripting > Scripts > New**
2. Suba ambos archivos JavaScript al File Cabinet en la carpeta SuiteScripts

### Paso 2: Crear Client Script Record
1. Vaya a **Customization > Scripting > Scripts > New**
2. Seleccione **Client Script**
3. Configure:
   - **ID**: `customscript_elm_concurrent_edit_alert_cs`
   - **Name**: `ELM - Alerta de Edición Concurrente (Client)`
   - **Script File**: Seleccione `ELM_ConcurrentEditAlert_CS.js`
   - **Function**: pageInit = `pageInit`, fieldChanged = `fieldChanged`, saveRecord = `saveRecord`

### Paso 3: Crear User Event Script Record
1. Vaya a **Customization > Scripting > Scripts > New**
2. Seleccione **User Event Script**
3. Configure:
   - **ID**: `customscript_elm_concurrent_edit_alert_ue`
   - **Name**: `ELM - Alerta de Edición Concurrente (User Event)`
   - **Script File**: Seleccione `ELM_ConcurrentEditAlert_UE.js`
   - **Function**: beforeLoad = `beforeLoad`, beforeSubmit = `beforeSubmit`, afterSubmit = `afterSubmit`

### Paso 4: Crear Script Deployments

#### Para User Event Script:
1. En el User Event Script record, vaya a **Deployments** subtab
2. Haga clic **New**
3. Configure:
   - **ID**: `customdeploy_elm_concurrent_edit_alert_ue`
   - **Title**: `ELM - Alerta Edición Concurrente Deployment`
   - **Status**: `Released`
   - **Record Type**: `Lead`
   - **Execute As Role**: `Administrator` (o un rol con permisos apropiados)

#### Para Client Script:
1. En el Client Script record, vaya a **Deployments** subtab
2. Haga clic **New**
3. Configure:
   - **ID**: `customdeploy_elm_concurrent_edit_alert_cs`
   - **Title**: `ELM - Client Script Edición Concurrente`
   - **Status**: `Released`
   - **Record Type**: `Lead`

### Paso 5: Configurar Permisos
Asegúrese de que los roles de usuario tengan permisos para:
- Ver y editar registros de Lead
- Ejecutar Client Scripts
- Acceder a campos personalizados relevantes

## Funcionamiento del Sistema

### Cuando un Usuario Edita un Lead:

1. **Carga de Página**:
   - El User Event Script inyecta automáticamente el Client Script
   - El Client Script se inicializa y obtiene el número de documento del Lead

2. **Verificación Continua**:
   - Cada 30 segundos, el Client Script busca otros Leads con el mismo número de documento
   - Verifica si han sido modificados recientemente (últimos 5 minutos)

3. **Detección de Edición Concurrente**:
   - Si encuentra otros Leads siendo editados, muestra una alerta visual
   - La alerta incluye información sobre quién está editando y cuándo

4. **Al Guardar**:
   - El User Event Script verifica cambios concurrentes antes de guardar
   - Agrega notas automáticas en los comentarios si detecta conflictos
   - Registra la actividad en los logs del sistema

### Ejemplo de Alerta:
```
⚠️ ATENCIÓN: El usuario "Juan Pérez" está editando otro Lead (LEAD12345) con el mismo número de documento (12345678). Última modificación: 09/09/2025 14:30. Por favor, coordine con el/los otro(s) usuario(s) para evitar conflictos de datos.
```

## Campos Utilizados

- **custentity_sdb_nrdocumento**: Campo que contiene el número de documento del Lead
- **comments**: Campo donde se registran las advertencias automáticas
- **lastmodified**: Campo del sistema para timestamp de última modificación
- **lastmodifiedby**: Campo del sistema para usuario que realizó la última modificación

## Consideraciones Técnicas

### Rendimiento:
- Las verificaciones se limitan a 10 registros máximo por búsqueda
- Intervalos de 30 segundos para no sobrecargar el sistema
- Verificación automática solo durante modo de edición

### Limitaciones:
- Requiere que los usuarios mantengan la página abierta para funcionar
- La alerta solo aparece si hay modificaciones en los últimos 5 minutos
- Depende de la conexión a internet del usuario

### Logging:
- Todas las actividades se registran en los NetSuite logs
- Las advertencias se guardan en los comentarios del Lead
- Información de auditoría disponible para análisis

## Troubleshooting

### La alerta no aparece:
1. Verificar que el Client Script esté deployado y released
2. Confirmar permisos de usuario
3. Revivar logs del sistema para errores
4. Verificar que el campo `custentity_sdb_nrdocumento` tenga valor

### Performance Issues:
1. Revisar la cantidad de Leads con el mismo documento
2. Considerar ajustar el intervalo de verificación
3. Revisar logs para errores de búsqueda

### Falsos Positivos:
1. Verificar configuración de zona horaria
2. Revisar que los timestamps sean correctos
3. Ajustar ventana de tiempo de verificación si es necesario

## Mantenimiento

- Revisar logs mensualmente para identificar patrones de uso
- Evaluar ajustes en intervalos de tiempo según uso del sistema
- Considerar expansión a otros tipos de registro si es necesario

## Autor
Gerardo Gonzalez - Sistema desarrollado para EnLaMano NetSuite implementation
