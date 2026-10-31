const app = require('./app');
const { port } = require('./config/env');

app.listen(port, () => {
  console.log(`TalentBridge API listening on http://localhost:${port}  (health: /api/health)`);
});
