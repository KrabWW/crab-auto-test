import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ModelProvidersService } from "./model-providers.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import type { CreateModelProviderRequest } from "@crab/shared-types";

@Controller("model-providers")
@UseGuards(SessionAuthGuard)
export class ModelProvidersController {
  constructor(private readonly providers: ModelProvidersService) {}

  @Get()
  list(@Query("projectId") projectId?: string) {
    return this.providers.list(projectId);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() body: CreateModelProviderRequest,
  ) {
    return this.providers.create(user.userId, body);
  }

  @Post(":id/validate")
  validate(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.providers.validate(id, user.userId);
  }
}
