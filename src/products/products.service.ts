import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import RemoveObjectFields from "../functions/RemoveObjectFields";
import { Repository, MoreThanOrEqual, Like, InsertResult, UpdateResult } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { ProductsEntity } from "./Entities/products.entity";
import { SaleEntity } from "./Entities/sale.entity";
import { SearchHistoryEntity } from "./Entities/searchHistory.entity";

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductsEntity)
    private productsRepository: Repository<ProductsEntity>,

    @InjectRepository(SearchHistoryEntity)
    private searchRepository: Repository<SearchHistoryEntity>,

    @InjectRepository(SaleEntity)
    private saleRepository: Repository<SaleEntity>,
  ) {}

  async getAll(skip: number = 0) {
    return this.productsRepository
      .findAndCount({
        select: ["prod_id", "price", "img_id", "title"],
        relations: ["img_id"],
        order: { prod_id: "DESC" },
        skip,
        take: 5,
      })
      .then(([res, amm]) => [res.map((prop) => ({ ...prop, img_id: prop.img_id.reverse() })), amm]);
  }

  async getCategories(): Promise<string[]> {
    return this.productsRepository
      .find({
        select: ["category"],
        cache: true,
      })
      .then((response) => [...new Set(response.map(({ category }) => category))]);
  }

  getByCategory(category: string) {
    return this.productsRepository.find({
      select: ["prod_id", "price", "img_id", "title"],
      where: { category },
      relations: ["img_id", "rating_id"],
    });
  }

  async getById(id: number) {
    return this.productsRepository
      .findOne({
        relations: ["img_id", "rating_id", "vendor"],
        where: { prod_id: id },
      })
      .then((response) => {
        return {
          ...response,
          vendor: RemoveObjectFields(response?.vendor, [
            "password",
            "user_type",
            "activated",
            "adress",
          ]),
        };
      });
  }

  async getByPriceRange(start: number, end: number): Promise<ProductsEntity[]> {
    return this.productsRepository
      .find({
        relations: ["img_id", "rating_id"],
        where: { price: MoreThanOrEqual(start) },
      })
      .then((res) =>
        res.map((p) => {
          if (p.price > end) {
            return p;
          }
        }),
      );
  }

  createProduct(props: any): Promise<InsertResult> {
    return this.productsRepository.insert(props);
  }

  getByTitleOrDesc(input: string): Promise<ProductsEntity[]> {
    return this.productsRepository.find({
      select: ["prod_id", "price", "img_id", "title"],
      relations: ["img_id", "rating_id"],
      where: [{ title: Like(`%${input}%`) }, { description: Like(`%${input}%`) }],
    });
  }

  pushSearchHistory(
    user_id: number,
    word: string,
    prod_id: QueryDeepPartialEntity<ProductsEntity[]>,
  ): Promise<InsertResult> {
    return this.searchRepository.insert({
      user_id,
      word,
      prod_id,
      date: new Date(),
    });
  }

  getSearchHistory(user_id: number): Promise<SearchHistoryEntity[]> {
    return this.searchRepository.find({
      where: { user_id },
    });
  }
  async getSearchHistoryProduct(user_id: number, skip: number): Promise<any[]> {
    return this.searchRepository
      .findAndCount({
        relations: ["prod_id", "img_id"],
        where: { user_id },
        skip,
        take: 5,
        order: {
          date: "DESC",
        },
      })
      .then(([res, ammount]) => {
        return [
          res.map(({ prod_id, img_id }: any) => ({
            ...prod_id,
            img_id: img_id.reverse(),
          })),
          ammount,
        ];
      });
  }

  async getProductSuggestions(text: string = "", params: any) {
    return this.productsRepository
      .find({
        select: ["prod_id", "img_id", "title", "price"],
        relations: ["img_id"],
        where: { title: Like(`%${text}%`), ...params },
        take: 5,
      })
      .then((response) => {
        return response.map((product) => ({
          title: product.title,
          prod_id: product.prod_id,
          image: product?.img_id[0]?.name,
          price: product.price,
        }));
      });
  }

  async getDailySaleProduct(): Promise<{
    hasMore: boolean;
    results: ProductsEntity;
  }> {
    return this.saleRepository
      .find({
        relations: ["prod_id", "prod_id.img_id"],
        order: {
          date: "DESC",
        },
        take: 1,
      })
      .then(([res]) => {
        if (typeof res !== "undefined") {
          return { hasMore: false, results: res.prod_id };
        }
      });
  }

  getProductsIds(): Promise<{ prod_id: number }[]> {
    return this.productsRepository.find({
      select: ["prod_id"],
    });
  }

  setDailySaleProduct(id: any): Promise<InsertResult> {
    return this.saleRepository.insert({ prod_id: id, type: "test" });
  }

  applyDiscount(prod_id: number, discount: number): Promise<UpdateResult> {
    return this.productsRepository.update({ prod_id }, { price: discount });
  }
}
