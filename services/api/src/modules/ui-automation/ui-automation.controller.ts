import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "../projects/membership.guard";
import { UiAutomationService } from "./ui-automation.service";
import type {
  CreateUiLocatorRequest,
  CreateUiPageObjectRequest,
  CreateUiPageStepRequest,
  UpdateUiPageObjectRequest,
} from "@crab/shared-types";

@Controller("projects/:projectId/ui-automation")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class UiAutomationController {
  constructor(private readonly ui: UiAutomationService) {}

  @Get("page-objects")
  list(@Param("projectId") projectId: string) {
    return this.ui.listPageObjects(projectId);
  }

  @Post("page-objects")
  create(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateUiPageObjectRequest,
  ) {
    return this.ui.createPageObject(projectId, user.userId, body);
  }

  @Get("page-objects/:id")
  get(@Param("projectId") projectId: string, @Param("id") id: string) {
    return this.ui.getPageObject(projectId, id);
  }

  @Patch("page-objects/:id")
  update(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateUiPageObjectRequest,
  ) {
    return this.ui.updatePageObject(projectId, id, user.userId, body);
  }

  @Delete("page-objects/:id")
  async delete(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.ui.deletePageObject(projectId, id, user.userId);
    return { ok: true };
  }

  @Post("page-objects/:id/locators")
  addLocator(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateUiLocatorRequest,
  ) {
    return this.ui.createLocator(projectId, id, user.userId, body);
  }

  @Delete("locators/:locatorId")
  async removeLocator(
    @Param("projectId") projectId: string,
    @Param("locatorId") locatorId: string,
  ) {
    await this.ui.deleteLocator(projectId, locatorId);
    return { ok: true };
  }

  @Post("page-objects/:id/steps")
  addStep(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateUiPageStepRequest,
  ) {
    return this.ui.createStep(projectId, id, user.userId, body);
  }

  @Delete("steps/:stepId")
  async removeStep(
    @Param("projectId") projectId: string,
    @Param("stepId") stepId: string,
  ) {
    await this.ui.deleteStep(projectId, stepId);
    return { ok: true };
  }
}
