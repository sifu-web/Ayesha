/**
 * Cloudinary configuration.
 * All media files (photos & videos) are stored exclusively on Cloudinary —
 * nothing is kept on local disk, so the app stays lightweight on a phone.
 */
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const FOLDER = process.env.CLOUDINARY_FOLDER || 'ayesha-gallery';

module.exports = { cloudinary, FOLDER };
