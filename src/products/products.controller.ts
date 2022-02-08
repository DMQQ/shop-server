import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  Post,
  Query,
  Res,
  HttpStatus,
  ParseIntPipe,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { ProductsDto } from "./dto/products.dto";
import { ProductsService } from "./products.service";
import { Response } from "express";
import { BAD, CREATED, OK } from "../constants/codes";
import { FAILED_CREATE, SUCCESS_CREATE } from "../constants/responses";
import { NotificationsService } from "../notifications/notifications.service";
import { expo, NewProductNotification } from "../notifications/methods";
import { RatingsService } from "../ratings/ratings.service";
import User from "../decorators/User";

@Controller("products")
export class ProductsController {
  constructor(
    private productsService: ProductsService,
    private notifyService: NotificationsService,
    @Inject(forwardRef(() => RatingsService))
    private ratingsService: RatingsService,
  ) {}

  @Get()
  async getAllProducts(@Query("skip") skip: number, @Res() response: Response) {
    return this.productsService.getAll(skip).then(([products, ammount]) => {
      response.send({
        hasMore: +skip + 5 < ammount,
        results: products,
      });
    });
  }

  @Get("categories")
  getCategories() {
    return this.productsService.getCategories();
  }

  @Get("search=:text")
  async getBySearchTitleOrDescription(
    @Param("text") text: string,
    @User() user_id: number,
    @Res() response: Response,
  ) {
    return this.productsService.getByTitleOrDesc(text).then((result) => {
      if (typeof result !== "undefined") {
        if (result.length > 0) {
          const [one] = result as any;
          this.productsService.pushSearchHistory(user_id, text, one.prod_id);
        }
        return response.status(HttpStatus.OK).send(result);
      }
      response.status(HttpStatus.OK).send([]);
    });
  }

  @Get("search-history")
  getSearchHistory(@User() user_id: number) {
    return this.productsService.getSearchHistory(user_id);
  }

  @Get("searched-products")
  async getSearchedProducts(
    @User() user_id: number,
    @Query("skip", new DefaultValuePipe(0), ParseIntPipe) skip: number,
  ) {
    return this.productsService
      .getSearchHistoryProduct(user_id, skip)
      .then(([products, ammount]) => {
        return {
          hasMore: +skip + 5 < ammount,
          results: products,
        };
      });
  }

  @Get("/category/:category")
  getProductsByCategory(@Param("category") category: string) {
    return this.productsService.getByCategory(category);
  }

  @Get("/product/:id")
  async getById(@Param("id", ParseIntPipe) id: number, @User() user_id: number) {
    return this.productsService.getById(id).then((result) => {
      if (typeof result !== "undefined") {
        this.productsService.pushSearchHistory(user_id, "", result.prod_id as any);
      }
      return result;
    });
  }

  @Get("/good-rated")
  async getMostSearched(@Query("skip", new DefaultValuePipe(0), ParseIntPipe) skip: number) {
    return this.ratingsService.findRatedMoreThanThree(skip).then(([products, ammount]) => {
      return {
        hasMore: +skip + 5 < ammount,
        results: products,
      };
    });
  }

  @Get("/suggestions")
  getProductSuggestions(@Query("q", new DefaultValuePipe("")) query: any, @Query() params: any) {
    const validParams = {};

    for (const [key, value] of Object.entries(params)) {
      if (key === "category" || key === "price" || key === "title") {
        validParams[key] = value;
      }
    }
    return this.productsService.getProductSuggestions(query, validParams);
  }

  @Post()
  createProduct(@Body() props: ProductsDto, @Res() response: Response, @User() id: number) {
    this.productsService
      .createProduct({ ...props, vendor: id })
      .then(({ raw }) => {
        if (raw.affectedRows > 0) {
          this.notifyService
            .getTokens()
            .then((res) => res.map(({ token }) => token))
            .then((tokens) => {
              expo.sendPushNotificationsAsync(NewProductNotification(tokens, props.title));
            });
          return response.status(CREATED).send({
            message: SUCCESS_CREATE,
            StatusCode: CREATED,
            id: raw.insertId,
          });
        } else {
          response.status(400).send({ message: FAILED_CREATE });
        }
      })
      .catch((err) =>
        response.status(BAD).send({
          message: err.message,
          code: BAD,
        }),
      );
  }
}
