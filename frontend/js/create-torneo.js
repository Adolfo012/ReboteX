// create-torneo.js - Manejo del formulario de creación de torneos

class TorneoCreator {
    constructor() {
        this.form = document.getElementById('torneoForm');
        this.init();
    }

    init() {
        if (this.form) {
            this.form.addEventListener('submit', this.handleSubmit.bind(this));
        }
    }

    async handleSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(this.form);
        
        const torneoData = {
            nombre: formData.get('nombre'),
            ubicacion: formData.get('ubicacion'),
            descripcion: formData.get('descripcion'),
            fecha_inicio: formData.get('fecha_inicio'),
            fecha_fin: formData.get('fecha_fin'),
            modalidad: formData.get('modalidad')
        };

        // Validaciones adicionales
        if (!this.validateForm(torneoData)) {
            return;
        }

        try {
            await this.createTorneo(torneoData);
        } catch (error) {
            console.error('Error al crear torneo:', error);
            this.showMessage('Error al crear el torneo. Por favor, intenta nuevamente.', 'error');
        }
    }

    validateForm(data) {
        // Validar campos obligatorios
        if (!data.nombre || !data.fecha_inicio) {
            this.showMessage('Por favor, completa todos los campos obligatorios.', 'error');
            return false;
        }

        // Validar fechas
        if (data.fecha_fin && new Date(data.fecha_fin) < new Date(data.fecha_inicio)) {
            this.showMessage('La fecha de fin no puede ser anterior a la fecha de inicio.', 'error');
            return false;
        }

        // Validar fecha de inicio no sea en el pasado
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const fechaInicio = new Date(data.fecha_inicio);
        
        if (fechaInicio < today) {
            this.showMessage('La fecha de inicio no puede ser en el pasado.', 'error');
            return false;
        }

        return true;
    }

    async createTorneo(torneoData) {
        const submitButton = this.form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        
        // Deshabilitar botón y mostrar estado de carga
        submitButton.disabled = true;
        submitButton.textContent = 'Creando...';

        // Obtener token de autenticación
        const token = localStorage.getItem('authToken');
        if (!token) {
            this.showMessage('Error: No se encontró token de autenticación. Por favor, inicia sesión nuevamente.', 'error');
            setTimeout(() => {
                window.location.href = '../login/login.html';
            }, 2000);
            return;
        }

        try {
            const response = await fetch('https://rebotex-backend.onrender.com/api/torneos/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(torneoData)
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage('¡Torneo creado exitosamente!', 'success');
                this.form.reset();
                
                // Redirigir al dashboard después de 2 segundos
                setTimeout(() => {
                    window.location.href = '../client/dashboard.html';
                }, 2000);
            } else {
                throw new Error(result.error || 'Error al crear el torneo');
            }
        } catch (error) {
            throw error;
        } finally {
            // Restaurar botón
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }

    getCurrentUserId() {
        try {
            // Obtener información del usuario desde localStorage
            const userData = localStorage.getItem('userData');
            if (userData) {
                const user = JSON.parse(userData);
                return user.id;
            }
            
            // Si no hay datos del usuario, redirigir al login
            console.error('No se encontró información del usuario. Redirigiendo al login...');
            window.location.href = '../login/login.html';
            return null;
        } catch (error) {
            console.error('Error al obtener ID del usuario:', error);
            window.location.href = '../login/login.html';
            return null;
        }
    }

    showMessage(message, type = 'info') {
        // Remover mensaje anterior si existe
        const existingMessage = document.querySelector('.form-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Crear nuevo mensaje
        const messageDiv = document.createElement('div');
        messageDiv.className = `form-message ${type}`;
        messageDiv.textContent = message;

        // Estilos para el mensaje
        messageDiv.style.cssText = `
            padding: 12px;
            margin: 10px 0;
            border-radius: 4px;
            font-weight: 500;
            text-align: center;
            ${type === 'success' ? 'background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : ''}
            ${type === 'error' ? 'background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;' : ''}
            ${type === 'info' ? 'background-color: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;' : ''}
        `;

        // Insertar mensaje antes del formulario
        this.form.parentNode.insertBefore(messageDiv, this.form);

        // Remover mensaje después de 5 segundos (excepto para success que se remueve al redirigir)
        if (type !== 'success') {
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 5000);
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new TorneoCreator();
});