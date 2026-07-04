import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { UiAutomationController } from "./ui-automation.controller";
import { UiAutomationService } from "./ui-automation.service";

@Module({
  imports: [AuditModule],
  controllers: [UiAutomationController],
  providers: [UiAutomationService],
  exports: [UiAutomationService],
})
export class UiAutomationModule {}
