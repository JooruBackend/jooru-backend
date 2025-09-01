const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Professional = require('./models/Professional');
const ServiceRequest = require('./models/ServiceRequest');
const Payment = require('./models/Payment');
const Review = require('./models/Review');
const Notification = require('./models/Notification');
require('dotenv').config();

// Conectar a la base de datos
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
};

// Datos de prueba
const testUsers = [
  {
    email: 'juan.perez@test.com',
    password: 'Test123!',
    profile: {
      firstName: 'Juan',
      lastName: 'Pérez',
      phone: '+34600111222',
      address: {
        street: 'Calle Mayor 123',
        city: 'Madrid',
        state: 'Madrid',
        zipCode: '28001',
        country: 'España'
      }
    },
    role: 'client',
    isVerified: true
  },
  {
    email: 'maria.garcia@test.com',
    password: 'Test123!',
    profile: {
      firstName: 'María',
      lastName: 'García',
      phone: '+34600333444',
      address: {
        street: 'Avenida de la Paz 45',
        city: 'Barcelona',
        state: 'Cataluña',
        zipCode: '08001',
        country: 'España'
      }
    },
    role: 'client',
    isVerified: true
  },
  {
    email: 'carlos.lopez@test.com',
    password: 'Test123!',
    profile: {
      firstName: 'Carlos',
      lastName: 'López',
      phone: '+34600555666',
      address: {
        street: 'Plaza España 10',
        city: 'Valencia',
        state: 'Valencia',
        zipCode: '46001',
        country: 'España'
      }
    },
    role: 'client',
    isVerified: true
  }
];

const testProfessionals = [
  {
    email: 'ana.martinez@professional.com',
    password: 'Prof123!',
    profile: {
      firstName: 'Ana',
      lastName: 'Martínez',
      phone: '+34700111222',
      address: {
        street: 'Calle Serrano 89',
        city: 'Madrid',
        state: 'Madrid',
        zipCode: '28006',
        country: 'España'
      }
    },
    role: 'professional',
    isVerified: true,
    professionalInfo: {
      services: [{
        category: 'cleaning',
        subcategory: 'house_cleaning',
        title: 'Limpieza del hogar',
        description: 'Servicios de limpieza profunda y mantenimiento de hogares',
        pricing: {
          type: 'hourly',
          amount: 15,
          currency: 'USD',
          unit: 'hour'
        },
        duration: {
          estimated: 240,
          unit: 'minutes'
        },
        isActive: true
      }, {
        category: 'cleaning',
        subcategory: 'office_cleaning',
        title: 'Limpieza de oficinas',
        description: 'Servicios de limpieza y mantenimiento de espacios comerciales',
        pricing: {
           type: 'hourly',
           amount: 15,
           currency: 'USD',
           unit: 'hour'
         },
        duration: {
          estimated: 180,
          unit: 'minutes'
        },
        isActive: true
      }],
      experience: 5,
      hourlyRate: 15,
      availability: {
        monday: { available: true, hours: ['09:00-18:00'] },
        tuesday: { available: true, hours: ['09:00-18:00'] },
        wednesday: { available: true, hours: ['09:00-18:00'] },
        thursday: { available: true, hours: ['09:00-18:00'] },
        friday: { available: true, hours: ['09:00-18:00'] },
        saturday: { available: true, hours: ['10:00-16:00'] },
        sunday: { available: false, hours: [] }
      },
      rating: 4.8,
      completedJobs: 127,
      description: 'Profesional de limpieza con 5 años de experiencia. Especializada en limpieza profunda y mantenimiento.',
      certifications: ['Certificado en limpieza profesional', 'Curso de productos ecológicos']
    }
  },
  {
    email: 'pedro.rodriguez@professional.com',
    password: 'Prof123!',
    profile: {
      firstName: 'Pedro',
      lastName: 'Rodríguez',
      phone: '+34700333444',
      address: {
        street: 'Calle Alcalá 156',
        city: 'Madrid',
        state: 'Madrid',
        zipCode: '28009',
        country: 'España'
      }
    },
    role: 'professional',
    isVerified: true,
    professionalInfo: {
      services: [{
        category: 'home_services',
        subcategory: 'plumbing',
        title: 'Plomería',
        description: 'Reparación e instalación de sistemas de plomería residencial',
        pricing: {
           type: 'hourly',
           amount: 25,
           currency: 'USD',
           unit: 'hour'
         },
        duration: {
          estimated: 120,
          unit: 'minutes'
        },
        isActive: true
      }, {
        category: 'home_services',
        subcategory: 'repairs',
        title: 'Reparaciones menores',
        description: 'Servicios de reparaciones domésticas menores',
        pricing: {
           type: 'hourly',
           amount: 25,
           currency: 'USD',
           unit: 'hour'
         },
        duration: {
          estimated: 90,
          unit: 'minutes'
        },
        isActive: true
      }],
      experience: 8,
      hourlyRate: 25,
      availability: {
        monday: { available: true, hours: ['08:00-17:00'] },
        tuesday: { available: true, hours: ['08:00-17:00'] },
        wednesday: { available: true, hours: ['08:00-17:00'] },
        thursday: { available: true, hours: ['08:00-17:00'] },
        friday: { available: true, hours: ['08:00-17:00'] },
        saturday: { available: true, hours: ['09:00-14:00'] },
        sunday: { available: false, hours: [] }
      },
      rating: 4.6,
      completedJobs: 89,
      description: 'Fontanero profesional con amplia experiencia en reparaciones domésticas y comerciales.',
      certifications: ['Certificado de fontanería', 'Curso de instalaciones sanitarias']
    }
  },
  {
    email: 'laura.fernandez@professional.com',
    password: 'Prof123!',
    profile: {
      firstName: 'Laura',
      lastName: 'Fernández',
      phone: '+34700555666',
      address: {
        street: 'Gran Vía 78',
        city: 'Barcelona',
        state: 'Cataluña',
        zipCode: '08010',
        country: 'España'
      }
    },
    role: 'professional',
    isVerified: true,
    professionalInfo: {
      services: [{
        category: 'home_services',
        subcategory: 'electrical',
        title: 'Electricidad',
        description: 'Servicios eléctricos residenciales y comerciales',
        pricing: {
           type: 'hourly',
           amount: 30,
           currency: 'USD',
           unit: 'hour'
         },
        duration: {
          estimated: 120,
          unit: 'minutes'
        },
        isActive: true
      }, {
        category: 'home_services',
        subcategory: 'electrical_installation',
        title: 'Instalaciones eléctricas',
        description: 'Instalación y mantenimiento de sistemas eléctricos',
        pricing: {
           type: 'hourly',
           amount: 30,
           currency: 'USD',
           unit: 'hour'
         },
        duration: {
          estimated: 180,
          unit: 'minutes'
        },
        isActive: true
      }],
      experience: 6,
      hourlyRate: 30,
      availability: {
        monday: { available: true, hours: ['09:00-18:00'] },
        tuesday: { available: true, hours: ['09:00-18:00'] },
        wednesday: { available: true, hours: ['09:00-18:00'] },
        thursday: { available: true, hours: ['09:00-18:00'] },
        friday: { available: true, hours: ['09:00-18:00'] },
        saturday: { available: false, hours: [] },
        sunday: { available: false, hours: [] }
      },
      rating: 4.9,
      completedJobs: 156,
      description: 'Electricista certificada con experiencia en instalaciones residenciales y comerciales.',
      certifications: ['Certificado de electricista', 'Curso de domótica']
    }
  }
];

// Función para crear usuarios
const createUsers = async () => {
  console.log('📝 Creando usuarios de prueba...');
  const users = [];
  
  for (const userData of testUsers) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    const user = new User({
      ...userData,
      password: hashedPassword
    });
    await user.save();
    users.push(user);
    console.log(`✅ Usuario creado: ${user.profile.firstName} ${user.profile.lastName} (${user.email})`);
  }
  
  return users;
};

// Función para crear profesionales
const createProfessionals = async () => {
  console.log('👷 Creando profesionales de prueba...');
  const professionals = [];
  
  for (const profData of testProfessionals) {
    const hashedPassword = await bcrypt.hash(profData.password, 12);
    
    // Crear usuario base
    const user = new User({
      email: profData.email,
      password: hashedPassword,
      profile: profData.profile,
      role: profData.role,
      isVerified: profData.isVerified
    });
    await user.save();
    
    // Crear perfil profesional
    const professional = new Professional({
      userId: user._id,
      services: profData.professionalInfo.services,
      experience: profData.professionalInfo.experience,
      hourlyRate: profData.professionalInfo.hourlyRate,
      availability: profData.professionalInfo.availability,
      rating: profData.professionalInfo.rating,
      completedJobs: profData.professionalInfo.completedJobs,
      description: profData.professionalInfo.description,
      certifications: profData.professionalInfo.certifications,
      isVerified: true
    });
    await professional.save();
    
    professionals.push({ user, professional });
    console.log(`✅ Profesional creado: ${user.profile.firstName} ${user.profile.lastName} (${profData.professionalInfo.services.join(', ')})`);
  }
  
  return professionals;
};

// Función para crear solicitudes de servicio
const createServiceRequests = async (users, professionals) => {
  console.log('🔧 Creando solicitudes de servicio...');
  const serviceRequests = [];
  
  const requests = [
    {
      clientId: users[0]._id,
      professionalId: professionals[0].professional._id,
      service: {
        category: 'cleaning',
        subcategory: 'house_cleaning',
        title: 'Limpieza del hogar',
        description: 'Limpieza completa de apartamento de 3 habitaciones',
        urgency: 'medium'
      },
      scheduling: {
        preferredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días en el futuro
        preferredTime: '10:00',
        flexibility: 'flexible',
        estimatedDuration: {
          value: 240,
          unit: 'minutes'
        }
      },
      pricing: {
        estimatedCost: 60,
        currency: 'USD'
      },
      status: 'completed',
      location: {
        address: {
          street: users[0].profile.address.street,
          city: users[0].profile.address.city,
          state: users[0].profile.address.state,
          zipCode: users[0].profile.address.zipCode,
          country: users[0].profile.address.country,
          fullAddress: `${users[0].profile.address.street}, ${users[0].profile.address.city}, ${users[0].profile.address.state} ${users[0].profile.address.zipCode}, ${users[0].profile.address.country}`
        },
        coordinates: [-74.0721, 4.7110] // Bogotá coordinates
      }
    },
    {
      clientId: users[1]._id,
      professionalId: professionals[1].professional._id,
      service: {
        category: 'home_services',
        subcategory: 'plumbing',
        title: 'Plomería',
        description: 'Reparación de fuga en el baño principal',
        urgency: 'high'
      },
      scheduling: {
        preferredDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 días en el futuro
        preferredTime: '14:00',
        flexibility: 'strict',
        estimatedDuration: {
          value: 120,
          unit: 'minutes'
        }
      },
      pricing: {
        estimatedCost: 50,
        currency: 'USD'
      },
      status: 'completed',
      location: {
        address: {
          street: users[1].profile.address.street,
          city: users[1].profile.address.city,
          state: users[1].profile.address.state,
          zipCode: users[1].profile.address.zipCode,
          country: users[1].profile.address.country,
          fullAddress: `${users[1].profile.address.street}, ${users[1].profile.address.city}, ${users[1].profile.address.state} ${users[1].profile.address.zipCode}, ${users[1].profile.address.country}`
        },
        coordinates: [-74.0721, 4.7110] // Bogotá coordinates
      }
    },
    {
      clientId: users[2]._id,
      professionalId: professionals[2].professional._id,
      service: {
        category: 'home_services',
        subcategory: 'electrical',
        title: 'Electricidad',
        description: 'Instalación de nuevos puntos de luz en cocina',
        urgency: 'medium'
      },
      scheduling: {
        preferredDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 días en el futuro
        preferredTime: '09:00',
        flexibility: 'flexible',
        estimatedDuration: {
          value: 180,
          unit: 'minutes'
        }
      },
      pricing: {
        estimatedCost: 90,
        currency: 'USD'
      },
      status: 'in_progress',
      location: {
        address: {
          street: users[2].profile.address.street,
          city: users[2].profile.address.city,
          state: users[2].profile.address.state,
          zipCode: users[2].profile.address.zipCode,
          country: users[2].profile.address.country,
          fullAddress: `${users[2].profile.address.street}, ${users[2].profile.address.city}, ${users[2].profile.address.state} ${users[2].profile.address.zipCode}, ${users[2].profile.address.country}`
        },
        coordinates: [-74.0721, 4.7110] // Bogotá coordinates
      }
    },
    {
      clientId: users[0]._id,
      professionalId: professionals[0].professional._id,
      service: {
        category: 'cleaning',
        subcategory: 'house_cleaning',
        title: 'Limpieza del hogar',
        description: 'Limpieza semanal de mantenimiento',
        urgency: 'low'
      },
      scheduling: {
        preferredDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 días en el futuro
        preferredTime: '11:00',
        flexibility: 'asap',
        estimatedDuration: {
          value: 120,
          unit: 'minutes'
        }
      },
      pricing: {
        estimatedCost: 30,
        currency: 'USD'
      },
      status: 'pending',
      location: {
        address: {
          street: users[0].profile.address.street,
          city: users[0].profile.address.city,
          state: users[0].profile.address.state,
          zipCode: users[0].profile.address.zipCode,
          country: users[0].profile.address.country,
          fullAddress: `${users[0].profile.address.street}, ${users[0].profile.address.city}, ${users[0].profile.address.state} ${users[0].profile.address.zipCode}, ${users[0].profile.address.country}`
        },
        coordinates: [-74.0721, 4.7110] // Bogotá coordinates
      }
    }
  ];
  
  for (const requestData of requests) {
    const serviceRequest = new ServiceRequest(requestData);
    await serviceRequest.save();
    serviceRequests.push(serviceRequest);
    console.log(`✅ Solicitud creada: ${serviceRequest.serviceType} - ${serviceRequest.status}`);
  }
  
  return serviceRequests;
};

// Función para crear pagos
const createPayments = async (serviceRequests, users, professionals) => {
  console.log('💳 Creando pagos de prueba...');
  const payments = [];
  
  // Solo crear pagos para servicios completados
  const completedRequests = serviceRequests.filter(req => req.status === 'completed');
  
  for (const request of completedRequests) {
    const payment = new Payment({
      paymentId: `pay_${Math.random().toString(36).substr(2, 9)}`,
      serviceRequest: request._id,
      client: request.clientId,
      professional: request.professionalId,
      amount: request.pricing.estimatedCost,
      platformFee: request.pricing.estimatedCost * 0.1, // 10% comisión
      totalAmount: request.pricing.estimatedCost + (request.pricing.estimatedCost * 0.1),
      currency: 'USD',
      status: 'completed',
      paymentMethod: {
        type: 'card',
        provider: 'stripe',
        details: {
          cardLast4: '4242',
          cardBrand: 'visa'
        }
      },
      transactionId: `txn_${Math.random().toString(36).substr(2, 9)}`,
      processedAt: new Date()
    });
    await payment.save();
    payments.push(payment);
    console.log(`✅ Pago creado: €${payment.amount} - ${payment.status}`);
  }
  
  return payments;
};

// Función para crear reseñas
const createReviews = async (serviceRequests, users, professionals) => {
  console.log('⭐ Creando reseñas de prueba...');
  const reviews = [];
  
  const reviewsData = [
    {
      serviceRequestId: serviceRequests[0]._id,
      reviewerId: users[0]._id,
      revieweeId: professionals[0].professional.userId,
      reviewerType: 'client',
      rating: {
        overall: 5,
        aspects: {
          punctuality: 5,
          quality: 5,
          communication: 5,
          value: 4
        }
      },
      comment: 'Excelente servicio, muy profesional y puntual. La limpieza fue impecable.',
      isVerified: true
    },
    {
      serviceRequestId: serviceRequests[1]._id,
      reviewerId: users[1]._id,
      revieweeId: professionals[1].professional.userId,
      reviewerType: 'client',
      rating: {
        overall: 4,
        aspects: {
          punctuality: 3,
          quality: 5,
          communication: 4,
          value: 4
        }
      },
      comment: 'Buen trabajo, aunque llegó un poco tarde. La reparación quedó perfecta.',
      isVerified: true
    }
  ];
  
  for (const reviewData of reviewsData) {
    const review = new Review(reviewData);
    await review.save();
    reviews.push(review);
    console.log(`✅ Reseña creada: ${review.rating} estrellas`);
  }
  
  return reviews;
};

// Función para crear notificaciones
const createNotifications = async (users, professionals) => {
  console.log('🔔 Creando notificaciones de prueba...');
  const notifications = [];
  
  const notificationsData = [
    {
      user: users[0]._id,
      title: 'Servicio completado',
      body: 'Tu servicio de limpieza ha sido completado exitosamente.',
      type: 'service_request',
      priority: 'medium',
      channels: ['push', 'in_app'],
      isRead: false
    },
    {
      user: professionals[0].professional.userId,
      title: 'Nueva solicitud de servicio',
      body: 'Tienes una nueva solicitud de servicio de limpieza.',
      type: 'service_request',
      priority: 'high',
      channels: ['push', 'email', 'in_app'],
      isRead: false
    },
    {
      user: users[1]._id,
      title: 'Pago procesado',
      body: 'Tu pago de $50 ha sido procesado correctamente.',
      type: 'payment',
      priority: 'medium',
      channels: ['push', 'email'],
      isRead: true
    }
  ];
  
  for (const notifData of notificationsData) {
    const notification = new Notification(notifData);
    await notification.save();
    notifications.push(notification);
    console.log(`✅ Notificación creada: ${notification.title}`);
  }
  
  return notifications;
};

// Función principal
const seedDatabase = async () => {
  try {
    console.log('🌱 Iniciando población de base de datos con datos de prueba...');
    
    await connectDB();
    
    // Verificar si ya existen datos de prueba
    const existingTestUser = await User.findOne({ email: 'juan.perez@test.com' });
    if (existingTestUser) {
      console.log('⚠️  Los datos de prueba ya existen. Ejecuta el script de limpieza primero.');
      process.exit(0);
    }
    
    // Crear datos de prueba
    const users = await createUsers();
    const professionals = await createProfessionals();
    const serviceRequests = await createServiceRequests(users, professionals);
    const payments = await createPayments(serviceRequests, users, professionals);
    const reviews = await createReviews(serviceRequests, users, professionals);
    const notifications = await createNotifications(users, professionals);
    
    console.log('\n🎉 ¡Datos de prueba creados exitosamente!');
    console.log(`📊 Resumen:`);
    console.log(`   - Usuarios: ${users.length}`);
    console.log(`   - Profesionales: ${professionals.length}`);
    console.log(`   - Solicitudes de servicio: ${serviceRequests.length}`);
    console.log(`   - Pagos: ${payments.length}`);
    console.log(`   - Reseñas: ${reviews.length}`);
    console.log(`   - Notificaciones: ${notifications.length}`);
    
    console.log('\n📝 Credenciales de prueba:');
    console.log('   Usuarios:');
    testUsers.forEach(user => {
      console.log(`     - ${user.email} / ${user.password}`);
    });
    console.log('   Profesionales:');
    testProfessionals.forEach(prof => {
      console.log(`     - ${prof.email} / ${prof.password}`);
    });
    
  } catch (error) {
    console.error('❌ Error poblando la base de datos:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexión a la base de datos cerrada.');
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };