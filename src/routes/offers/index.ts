import { Router } from "express";
import certificateRoutes from "./certificate/routes";

const router = Router();

/**
 * Registro das ofertas
 */
router.use("/certificate", certificateRoutes);

export default router;