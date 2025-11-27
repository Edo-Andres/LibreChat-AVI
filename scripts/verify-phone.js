const mongoose = require('mongoose');

// Configuration
const API_URL = 'http://localhost:3080/api/auth/register';
const MONGO_URI = 'mongodb://localhost:27017/LibreChat';

const testUser = {
  name: 'Phone Test User',
  username: `phonetest_${Date.now()}`,
  email: `phonetest_${Date.now()}@example.com`,
  password: 'password123',
  confirm_password: 'password123',
  phone: '555-0199'
};

async function verify() {
  console.log('--- Verificación de Campo Teléfono ---');
  console.log('1. Registrando usuario vía API...');
  console.log('   Payload:', JSON.stringify(testUser, null, 2));

  try {
    // Use dynamic import for node-fetch if needed, or native fetch
    let response;
    try {
        response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
    } catch (e) {
        console.error('Error conectando a la API. Asegúrate de que el backend esté corriendo en el puerto 3080.');
        console.error(e.message);
        process.exit(1);
    }

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Registro fallido:', data);
      process.exit(1);
    }
    console.log('✅ Registro exitoso (API respondió 200 OK)');

    console.log('2. Verificando en Base de Datos (MongoDB)...');
    await mongoose.connect(MONGO_URI);
    
    const User = mongoose.connection.db.collection('users');
    const user = await User.findOne({ email: testUser.email });

    if (!user) {
      console.error('❌ Usuario no encontrado en la base de datos!');
      process.exit(1);
    }

    console.log('   Usuario encontrado:', {
      _id: user._id,
      email: user.email,
      phone: user.phone
    });

    if (user.phone === testUser.phone) {
      console.log('✅ ÉXITO: El campo "phone" se guardó correctamente en la base de datos.');
    } else {
      console.error(`❌ FALLO: El campo "phone" no coincide. Esperado: "${testUser.phone}", Obtenido: "${user.phone}"`);
      console.log('   Posible causa: El backend no se ha reconstruido o reiniciado con los nuevos esquemas.');
    }

  } catch (error) {
    console.error('Error inesperado:', error);
  } finally {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
  }
}

verify();
