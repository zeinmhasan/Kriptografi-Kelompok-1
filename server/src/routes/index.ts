import { Router } from 'express';
import * as auth from '../controllers/authController.ts';
import * as files from '../controllers/fileController.ts';
import * as lab from '../controllers/labController.ts';
import * as shares from '../controllers/shareController.ts';
import * as signatures from '../controllers/signatureController.ts';
import * as users from '../controllers/userController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { fileAndSignature, singleFile } from '../middleware/upload.ts';

export const apiRouter = Router();

apiRouter.post('/auth/register', auth.register);
apiRouter.post('/auth/login', auth.login);
apiRouter.post('/auth/logout', auth.logout);

// Semua endpoint di bawah ini membutuhkan sesi login.
apiRouter.use(requireAuth);

apiRouter.get('/auth/me', auth.me);
apiRouter.post('/auth/change-password', auth.changePassword);

apiRouter.get('/users/search', users.searchUsers);
apiRouter.get('/users/:username/keys', users.getPublicKeys);

apiRouter.get('/files', files.listFiles);
apiRouter.post('/files', singleFile, files.uploadFile);
apiRouter.get('/files/:id', files.getFile);
apiRouter.get('/files/:id/raw', files.downloadEncrypted);
apiRouter.post('/files/:id/decrypt', files.decryptFile);
apiRouter.delete('/files/:id', files.deleteFile);

apiRouter.post('/files/:id/sign', signatures.sign);
apiRouter.post('/files/:id/verify', signatures.verifyStored);
apiRouter.get('/files/:id/signature', signatures.downloadSignature);
apiRouter.post('/verify', fileAndSignature, signatures.verifyExternal);

apiRouter.post('/files/:id/share', shares.share);
apiRouter.delete('/files/:id/share/:userId', shares.revoke);

apiRouter.post('/files/:id/tamper-test', lab.tamperTest);
apiRouter.get('/lab/selftest', lab.selfTest);
apiRouter.get('/lab/benchmark', lab.benchmark);
apiRouter.get('/lab/parameters', lab.parameters);
