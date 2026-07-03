import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { TestSuitesController } from "./test-suites.controller";
import { TestSuitesService } from "./test-suites.service";

@Module({
  imports: [AuditModule],
  controllers: [TestSuitesController],
  providers: [TestSuitesService],
})
export class TestSuitesModule {}
