import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { TestAssetsController } from "./test-assets.controller";
import { TestAssetsService } from "./test-assets.service";

@Module({
  imports: [AuditModule],
  controllers: [TestAssetsController],
  providers: [TestAssetsService],
  exports: [TestAssetsService],
})
export class TestAssetsModule {}
