import { Router, type IRouter } from "express";
import healthRouter from "./health";
import spaRouter from "./spa";

const router: IRouter = Router();

router.use(healthRouter);
router.use(spaRouter);

export default router;
