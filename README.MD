If any secret in thus project was ever committed to git in plaintext
(check history with 'git log -p -- .env setup*sh' before your first
push), rotate it immediately:
- MongoDb Atlas database user password
-JWT_SECRET (regenerate via: node -e "console.log(;crypto').randomBytes(32).toString('hex'))")
-Cloudinary API secret
-Gmail app Password

Never commit .env, my-token.txr, or test-*.json - see .gitignore.
Use .env.example as the template for  required variables.
