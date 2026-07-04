import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { McpController } from "./mcp.controller";
import { McpService } from "./mcp.service";
import { McpServersController } from "./mcp-servers.controller";
import { McpServersService } from "./mcp-servers.service";

@Module({
  imports: [AuditModule],
  controllers: [McpController, McpServersController],
  providers: [McpService, McpServersService],
  exports: [McpService, McpServersService],
})
export class McpModule {}
