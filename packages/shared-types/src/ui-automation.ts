/** UI automation asset contracts: reusable page objects, locators, and steps. */

export type UiLocatorStrategy = "css" | "xpath" | "id" | "data-testid" | "text" | "role";
export type UiPageStepAction =
  | "navigate"
  | "click"
  | "fill"
  | "select"
  | "assert"
  | "wait"
  | "screenshot";

export interface UiLocatorDto {
  id: string;
  pageObjectId: string;
  projectId: string;
  name: string;
  strategy: UiLocatorStrategy;
  value: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UiPageStepDto {
  id: string;
  pageObjectId: string;
  projectId: string;
  order: number;
  action: UiPageStepAction;
  locatorId?: string;
  value?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UiPageObjectDto {
  id: string;
  projectId: string;
  name: string;
  urlPattern?: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  locators: UiLocatorDto[];
  steps: UiPageStepDto[];
}

export interface CreateUiPageObjectRequest {
  name: string;
  urlPattern?: string;
  description?: string;
}

export type UpdateUiPageObjectRequest = Partial<CreateUiPageObjectRequest>;

export interface CreateUiLocatorRequest {
  name: string;
  strategy: UiLocatorStrategy;
  value: string;
  description?: string;
}

export interface CreateUiPageStepRequest {
  order: number;
  action: UiPageStepAction;
  locatorId?: string;
  value?: string;
  description?: string;
}
