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
  BadRequestException,
  NotFoundException,
  UseInterceptors,
} from "@nestjs/common";
import { ProductsDto } from "./dto/products.dto";
import { ProductsService } from "./products.service";
import { Response } from "express";
import { CREATED } from "../utils/constants/codes";
import { FAILED_CREATE, SUCCESS_CREATE } from "../utils/constants/responses";
import { RatingsService } from "../ratings/ratings.service";
import User from "../utils/decorators/User";
import { PagingInterceptor } from "../utils/functions/PagingInterceptor";

@Controller("products")
export class ProductsController {
  constructor(
    private productsService: ProductsService,
    @Inject(forwardRef(() => RatingsService))
    private ratingsService: RatingsService,
  ) {}

  @Get()
  @UseInterceptors(PagingInterceptor)
  async getAllProducts(@Query("skip") skip: number) {
    return this.productsService.getAll(skip);
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
          this.productsService.pushSearchHistory(user_id, one.prod_id);
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

  @Get("/category")
  @UseInterceptors(PagingInterceptor)
  getProductsByCategory(@Query("q") category: string, @Query("skip") skip: number) {
    return this.productsService.getByCategory(category, skip);
  }

  @Get("/good-rated")
  @UseInterceptors(PagingInterceptor)
  async getMostSearched(@Query("skip", new DefaultValuePipe(0), ParseIntPipe) skip: number) {
    return this.ratingsService.findRatedMoreThanThree(skip);
  }

  @Get("/suggestions")
  async getProductSuggestions(@Query("q") query = "", @Query() params: any) {
    const validParams = {};
    const validKeys = ["category", "price", "title", "manufacturer"];

    for (const [key, value] of Object.entries(params)) {
      if (validKeys.includes(key)) validParams[key] = value;
    }
    return this.productsService.getProductSuggestions(query, validParams).then((response) => {
      return response.map((product) => ({
        title: product.title,
        prod_id: product.prod_id,
        image: product?.img_id[0]?.name,
        price: +product.price,
      }));
    });
  }

  @Get("/:id")
  async getById(@Param("id", ParseIntPipe) id: number, @User() user_id: number) {
    try {
      const result = await this.productsService.getById(id);

      if (typeof result !== "undefined") {
        this.productsService.pushSearchHistory(user_id, result.prod_id as any);
      }

      return result;
    } catch (error) {
      throw new NotFoundException(`Couldn't find post with id: ${id}`);
    }
  }

  @Post()
  async createProduct(
    @Body() props: ProductsDto,
    @Res() response: Response,
    @User() vendor: number,
  ) {
    const { raw } = await this.productsService.createProduct({ ...props, vendor });
    if (raw.affectedRows > 0) {
      return response.status(CREATED).send({
        message: SUCCESS_CREATE,
        StatusCode: CREATED,
        id: raw.insertId,
      });
    }
    throw new BadRequestException(FAILED_CREATE);
  }
}
