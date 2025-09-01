const mongoose = require('mongoose');
const Review = require('./models/Review');
require('dotenv').config();

async function checkRatings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('=== VERIFICANDO CALIFICACIONES ===');
    
    const reviews = await Review.find();
    console.log('Total reviews:', reviews.length);
    
    reviews.forEach((review, index) => {
      console.log(`Review ${index + 1}:`, {
        overall: review.rating?.overall,
        rating: review.rating
      });
    });
    
    const avgTest = await Review.aggregate([
      {
        $group: {
          _id: null,
          avg: { $avg: '$rating.overall' }
        }
      }
    ]);
    
    console.log('Promedio calculado:', avgTest[0]?.avg || 0);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRatings();